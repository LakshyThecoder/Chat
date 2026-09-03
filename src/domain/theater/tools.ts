import { z } from "zod";
import { TheaterSessionError } from "@/src/domain/theater/errors";

export const THEATER_TOOL_NAMES = [
  "list_work_items",
  "get_work_item",
  "inspect_counter",
  "compute_entitlement",
  "prepare_filing",
  "request_signature",
  "execute_filing",
  "verify_filing",
] as const;

export type TheaterToolName = (typeof THEATER_TOOL_NAMES)[number];

export type TheaterToolSideEffect = "read" | "compute" | "prepare" | "mutate" | "verify";

export interface TheaterToolDefinition {
  name: TheaterToolName;
  description: string;
  sideEffect: TheaterToolSideEffect;
  authorization: "session-cookie";
  idempotent: boolean;
  requiresWorkItemId: boolean;
  inputSchema: Record<string, unknown>;
}

const workItemProperties = {
  workItemId: { type: "string", format: "uuid", description: "Work item id from list_work_items." },
} as const;

const workItemInputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["workItemId"],
  properties: workItemProperties,
} as const;

const noInputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {},
} as const;

export const THEATER_TOOLS: TheaterToolDefinition[] = [
  {
    name: "list_work_items",
    description:
      "List the three disputes on this desk and their live states. Use this first. The FR0999 / BERG booking is already claimed and must not be filed.",
    sideEffect: "read",
    authorization: "session-cookie",
    idempotent: true,
    requiresWorkItemId: false,
    inputSchema: noInputSchema,
  },
  {
    name: "get_work_item",
    description: "Read one theater work item by workItemId, including next permitted actions.",
    sideEffect: "read",
    authorization: "session-cookie",
    idempotent: true,
    requiresWorkItemId: true,
    inputSchema: workItemInputSchema,
  },
  {
    name: "inspect_counter",
    description:
      "Read the live provider record for this dispute and paint it on the desk (booking or subscription plus any existing claim). Read-only. Does not file.",
    sideEffect: "read",
    authorization: "session-cookie",
    idempotent: true,
    requiresWorkItemId: true,
    inputSchema: workItemInputSchema,
  },
  {
    name: "compute_entitlement",
    description:
      "Compute deterministic entitlement from the observed provider state and published policy. Software owns the amount. Does not submit anything.",
    sideEffect: "compute",
    authorization: "session-cookie",
    idempotent: true,
    requiresWorkItemId: true,
    inputSchema: workItemInputSchema,
  },
  {
    name: "prepare_filing",
    description:
      "Prepare a single high-impact filing proposal (tool name, payload, amount, idempotency key, expected verification). Does not execute. Refuses ineligible and already-claimed rows. Does not erase a signature.",
    sideEffect: "prepare",
    authorization: "session-cookie",
    idempotent: true,
    requiresWorkItemId: true,
    inputSchema: workItemInputSchema,
  },
  {
    name: "request_signature",
    description:
      "Request the human signature for a prepared filing. After this, execute_filing may proceed only if the person on this page signs the prepared amount.",
    sideEffect: "prepare",
    authorization: "session-cookie",
    idempotent: true,
    requiresWorkItemId: true,
    inputSchema: workItemInputSchema,
  },
  {
    name: "execute_filing",
    description:
      "File the signed dispute at the provider. Fails with APPROVAL_REQUIRED until the person on this page signs the prepared amount. Idempotent. Does not declare success — call verify_filing.",
    sideEffect: "mutate",
    authorization: "session-cookie",
    idempotent: true,
    requiresWorkItemId: true,
    inputSchema: workItemInputSchema,
  },
  {
    name: "verify_filing",
    description:
      "Re-read the provider row and compare it to the signed amount and identity. Only matched=true is success. Paints expected vs observed on the desk.",
    sideEffect: "verify",
    authorization: "session-cookie",
    idempotent: true,
    requiresWorkItemId: true,
    inputSchema: workItemInputSchema,
  },
];

export const theaterToolNameSchema = z.enum(THEATER_TOOL_NAMES);
export const workItemIdSchema = z.string().uuid();

export function parseTheaterToolName(value: unknown): TheaterToolName {
  return theaterToolNameSchema.parse(value);
}

export function parseWorkItemId(input: Record<string, unknown>): string {
  const parsed = workItemIdSchema.safeParse(input.workItemId);
  if (!parsed.success) {
    throw new TheaterSessionError("INVALID_ARGUMENT", "workItemId must be a UUID.", 400);
  }
  return parsed.data;
}

export function getTheaterTool(name: TheaterToolName): TheaterToolDefinition {
  const tool = THEATER_TOOLS.find((entry) => entry.name === name);
  if (!tool) {
    throw new Error(`Unknown theater tool: ${name}`);
  }
  return tool;
}
