import { MAIL_DESK_TOOLS, type MailDeskToolName } from "@/src/domain/mail-desk/tools";
import type { MailDeskSnapshot } from "@/src/domain/mail-desk/types";
import { THEATER_WEBMCP_EVENT, pulseTheaterTool } from "@/components/theater/pulse";

export const MAIL_DESK_STATE_EVENT = "aegis:mail-desk:state";

export async function runMailDeskTool(name: MailDeskToolName, input: Record<string, unknown>) {
  const response = await fetch("/api/demo/mail/tools", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool: name, input }),
  });
  const payload = (await response.json()) as {
    error?: { message?: string; code?: string; requestId?: string };
    desk?: MailDeskSnapshot;
    [key: string]: unknown;
  };

  const code = payload.error?.code;
  const message = payload.error?.message ?? (response.ok ? `${name} updated the mail desk` : `${name} failed`);
  pulseTheaterTool({
    name,
    ok: response.ok,
    message: code ? `${code} — ${message}` : message,
    at: new Date().toISOString(),
    input,
    output: payload,
    requestId: payload.error?.requestId,
    code,
  });
  if (payload.desk) {
    window.dispatchEvent(new CustomEvent(MAIL_DESK_STATE_EVENT, { detail: payload.desk }));
  }
  // Also nudge theater console listeners.
  window.dispatchEvent(new CustomEvent(THEATER_WEBMCP_EVENT, {
    detail: {
      name,
      ok: response.ok,
      message: code ? `${code} — ${message}` : message,
      at: new Date().toISOString(),
      input,
      code,
    },
  }));
  if (!response.ok) {
    throw new Error(code ? `${code}: ${message}` : message);
  }
  return payload;
}

export function registerMailDeskTools(
  context: NonNullable<Document["modelContext"]>,
  execute: (name: MailDeskToolName, input: Record<string, unknown>) => Promise<unknown>,
): string[] {
  for (const tool of MAIL_DESK_TOOLS) {
    const handler = (input: Record<string, unknown>) => execute(tool.name, input ?? {});
    try {
      context.registerTool({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        execute: handler,
      });
    } catch {
      /* duplicate host entry — ignore */
    }
  }
  return MAIL_DESK_TOOLS.map((tool) => tool.name);
}
