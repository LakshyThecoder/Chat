import "server-only";

import { z } from "zod";
import { getServerEnv } from "@/src/config/env";

const exaResultSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  publishedDate: z.string().nullable().optional(),
  highlights: z.array(z.string()).default([]),
});

const briefingSchema = z.object({
  briefing: z.string().min(1),
  compensationNotes: z.string().min(1),
  careNotes: z.string().min(1),
  exceptions: z.string().min(1),
  claimDeadline: z.string().min(1),
});

const exaResponseSchema = z.object({
  requestId: z.string().optional(),
  results: z.array(exaResultSchema),
  output: z
    .object({
      content: briefingSchema,
    })
    .optional(),
});

export const passengerRightsResearchInputSchema = z.object({
  origin: z.string().regex(/^[A-Z]{3}$/),
  destination: z.string().regex(/^[A-Z]{3}$/),
  regime: z.enum(["EU261", "UK261", "DOT"]),
  disruption: z.enum(["cancelled", "delayed", "denied_boarding"]),
});

export type PassengerRightsResearchInput = z.infer<typeof passengerRightsResearchInputSchema>;

export interface PassengerRightsSource {
  title: string;
  url: string;
  publishedDate: string | null;
  highlights: string[];
}

export interface PassengerRightsBriefing {
  briefing: string;
  compensationNotes: string;
  careNotes: string;
  exceptions: string;
  claimDeadline: string;
}

export interface PassengerRightsResearch {
  query: string;
  regime: PassengerRightsResearchInput["regime"];
  disruption: PassengerRightsResearchInput["disruption"];
  briefing: PassengerRightsBriefing | null;
  sources: PassengerRightsSource[];
  providerRequestId: string | null;
  authoritativeAmount: false;
}

const DOMAINS: Record<PassengerRightsResearchInput["regime"], string[]> = {
  EU261: ["europa.eu", "eur-lex.europa.eu", "ec.europa.eu"],
  UK261: ["caa.co.uk", "legislation.gov.uk", "gov.uk"],
  DOT: ["transportation.gov", "dot.gov"],
};

const OUTPUT_SCHEMA = {
  type: "object",
  description: "Grounded passenger-rights briefing from official sources only",
  required: ["briefing", "compensationNotes", "careNotes", "exceptions", "claimDeadline"],
  properties: {
    briefing: {
      type: "string",
      description: "Two-sentence grounded summary of the passenger right for this disruption",
    },
    compensationNotes: {
      type: "string",
      description: "What official sources say about cash compensation or refund eligibility",
    },
    careNotes: {
      type: "string",
      description: "Meals, hotels, rerouting, or care obligations mentioned by official sources",
    },
    exceptions: {
      type: "string",
      description: "Extraordinary circumstances or other official exceptions",
    },
    claimDeadline: {
      type: "string",
      description: "Any official claim deadline or limitation period mentioned; say unknown if absent",
    },
  },
} as const;

export class ExaNotConfiguredError extends Error {
  readonly code = "EXA_NOT_CONFIGURED";

  constructor() {
    super("Live official-source research is not configured.");
    this.name = "ExaNotConfiguredError";
  }
}

export class ExaResearchError extends Error {
  readonly code = "EXA_RESEARCH_FAILED";

  constructor(message: string) {
    super(message);
    this.name = "ExaResearchError";
  }
}

export async function researchPassengerRights(
  rawInput: PassengerRightsResearchInput,
  fetchImpl: typeof fetch = fetch,
): Promise<PassengerRightsResearch> {
  const input = passengerRightsResearchInputSchema.parse(rawInput);
  const apiKey = getServerEnv().EXA_API_KEY;
  if (!apiKey) throw new ExaNotConfiguredError();

  const query =
    `Official ${input.regime} air passenger rights for a ${input.disruption} flight ` +
    `from ${input.origin} to ${input.destination}: compensation bands, unused-fare refund, ` +
    `care obligations, extraordinary circumstances, and claim deadlines`;

  const response = await fetchImpl("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      query,
      type: "auto",
      numResults: 8,
      includeDomains: DOMAINS[input.regime],
      moderation: true,
      systemPrompt:
        "Prefer official government and regulator pages only. Collapse duplicates. Never invent amounts. Keep every claim grounded in the retrieved sources.",
      outputSchema: OUTPUT_SCHEMA,
      contents: {
        highlights: {
          query: "Eligibility, compensation, refund, care, exceptions, and claim deadline",
          maxCharacters: 1800,
        },
      },
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new ExaResearchError(`Official-source search returned HTTP ${response.status}.`);
  }

  const parsed = exaResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new ExaResearchError("Official-source search returned an invalid response.");
  }

  return {
    query,
    regime: input.regime,
    disruption: input.disruption,
    briefing: parsed.data.output?.content ?? null,
    providerRequestId: parsed.data.requestId ?? null,
    authoritativeAmount: false,
    sources: parsed.data.results.map((result) => ({
      title: result.title,
      url: result.url,
      publishedDate: result.publishedDate ?? null,
      highlights: result.highlights,
    })),
  };
}
