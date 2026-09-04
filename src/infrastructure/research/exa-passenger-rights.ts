import "server-only";

import { z } from "zod";
import { getServerEnv } from "@/src/config/env";

const exaResultSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  publishedDate: z.string().nullable().optional(),
  highlights: z.array(z.string()).default([]),
});

const exaResponseSchema = z.object({
  requestId: z.string().optional(),
  results: z.array(exaResultSchema),
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

export interface PassengerRightsResearch {
  query: string;
  sources: PassengerRightsSource[];
  providerRequestId: string | null;
}

const DOMAINS: Record<PassengerRightsResearchInput["regime"], string[]> = {
  EU261: ["europa.eu", "eur-lex.europa.eu"],
  UK261: ["caa.co.uk", "legislation.gov.uk"],
  DOT: ["transportation.gov"],
};

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
    `Official ${input.regime} passenger rights for a ${input.disruption} flight ` +
    `from ${input.origin} to ${input.destination}; compensation, refund, care, exceptions, and claim deadline`;

  const response = await fetchImpl("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      query,
      type: "auto",
      numResults: 6,
      includeDomains: DOMAINS[input.regime],
      moderation: true,
      contents: {
        highlights: {
          query: "Eligibility, amount, passenger care, exceptions, deadline, and official legal basis",
          maxCharacters: 1800,
        },
      },
    }),
    signal: AbortSignal.timeout(12_000),
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
    providerRequestId: parsed.data.requestId ?? null,
    sources: parsed.data.results.map((result) => ({
      title: result.title,
      url: result.url,
      publishedDate: result.publishedDate ?? null,
      highlights: result.highlights,
    })),
  };
}
