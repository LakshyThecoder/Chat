import { z } from "zod";

export const MAIL_DESK_TOOL_NAMES = [
  "list_mail_disputes",
  "inspect_mail",
  "import_bill",
  "lookup_refund_policy",
  "prepare_support_email",
  "request_mail_signature",
  "send_support_email",
  "verify_sent",
  "begin_mail_resolution",
] as const;

export type MailDeskToolName = (typeof MAIL_DESK_TOOL_NAMES)[number];

export interface MailDeskToolDefinition {
  name: MailDeskToolName;
  description: string;
  sideEffect: "read" | "compute" | "prepare" | "mutate" | "verify" | "orchestrate";
  authorization: "session-cookie";
  idempotent: boolean;
  requiresItemId: boolean;
  inputSchema: Record<string, unknown>;
}

const noInput = { type: "object", additionalProperties: false, properties: {} } as const;
const itemInput = {
  type: "object",
  additionalProperties: false,
  required: ["itemId"],
  properties: {
    itemId: { type: "string", format: "uuid", description: "Mail dispute item id from list_mail_disputes." },
  },
} as const;

export const MAIL_DESK_TOOLS: MailDeskToolDefinition[] = [
  {
    name: "begin_mail_resolution",
    description:
      "Primary mail entry when the human asks to check email for a subscription refund. Detects billed-after-cancel disputes, imports the bill, looks up policy, prepares a support email, and stops for human signature. Never sends mail.",
    sideEffect: "orchestrate",
    authorization: "session-cookie",
    idempotent: true,
    requiresItemId: false,
    inputSchema: noInput,
  },
  {
    name: "list_mail_disputes",
    description: "List sandbox mailbox disputes on this desktop and their live states.",
    sideEffect: "read",
    authorization: "session-cookie",
    idempotent: true,
    requiresItemId: false,
    inputSchema: noInput,
  },
  {
    name: "inspect_mail",
    description: "Open one mail dispute and paint the message on the Mail Disputes window.",
    sideEffect: "read",
    authorization: "session-cookie",
    idempotent: true,
    requiresItemId: true,
    inputSchema: itemInput,
  },
  {
    name: "import_bill",
    description: "Import the attached invoice/bill for a mail dispute. Amounts come from the bill, not the model.",
    sideEffect: "prepare",
    authorization: "session-cookie",
    idempotent: true,
    requiresItemId: true,
    inputSchema: itemInput,
  },
  {
    name: "lookup_refund_policy",
    description: "Read the merchant refund policy with provenance. Does not invent eligibility.",
    sideEffect: "compute",
    authorization: "session-cookie",
    idempotent: true,
    requiresItemId: true,
    inputSchema: itemInput,
  },
  {
    name: "prepare_support_email",
    description: "Draft a support email from bill + policy. Does not send. Does not erase a signature.",
    sideEffect: "prepare",
    authorization: "session-cookie",
    idempotent: true,
    requiresItemId: true,
    inputSchema: itemInput,
  },
  {
    name: "request_mail_signature",
    description: "Ask the human on this page to sign the refund amount and outbound email before send.",
    sideEffect: "prepare",
    authorization: "session-cookie",
    idempotent: true,
    requiresItemId: true,
    inputSchema: itemInput,
  },
  {
    name: "send_support_email",
    description:
      "Send the signed support email from the sandbox mailbox. Fails with APPROVAL_REQUIRED until signed. Idempotent.",
    sideEffect: "mutate",
    authorization: "session-cookie",
    idempotent: true,
    requiresItemId: true,
    inputSchema: itemInput,
  },
  {
    name: "verify_sent",
    description: "Re-read the outbound mail record. Only matched=true counts as success.",
    sideEffect: "verify",
    authorization: "session-cookie",
    idempotent: true,
    requiresItemId: true,
    inputSchema: itemInput,
  },
];

export const mailDeskToolNameSchema = z.enum(MAIL_DESK_TOOL_NAMES);
export const mailDeskItemIdSchema = z.string().uuid();

export function parseMailDeskToolName(value: unknown): MailDeskToolName {
  return mailDeskToolNameSchema.parse(value);
}

export function parseMailDeskItemId(input: Record<string, unknown>): string {
  const parsed = mailDeskItemIdSchema.safeParse(input.itemId);
  if (!parsed.success) {
    throw new Error("itemId must be a UUID.");
  }
  return parsed.data;
}

export function getMailDeskTool(name: MailDeskToolName): MailDeskToolDefinition {
  const tool = MAIL_DESK_TOOLS.find((entry) => entry.name === name);
  if (!tool) throw new Error(`Unknown mail desk tool: ${name}`);
  return tool;
}
