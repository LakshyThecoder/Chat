import { THEATER_TOOLS, type TheaterToolName } from "@/src/domain/theater/tools";
import type { TheaterSnapshot } from "@/src/domain/theater/types";
import { THEATER_STATE_EVENT, pulseTheaterTool } from "@/components/theater/pulse";

export async function runTheaterTool(name: TheaterToolName, input: Record<string, unknown>) {
  const response = await fetch("/api/demo/theater/tools", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool: name, input }),
  });
  const payload = (await response.json()) as {
    error?: { message?: string; code?: string; requestId?: string };
    theater?: TheaterSnapshot;
    [key: string]: unknown;
  };

  const code = payload.error?.code;
  const message = payload.error?.message ?? (response.ok ? `${name} wrote into this page` : `${name} failed`);
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
  if (payload.theater) {
    window.dispatchEvent(new CustomEvent(THEATER_STATE_EVENT, { detail: payload.theater }));
  }
  if (!response.ok) {
    throw new Error(code ? `${code}: ${message}` : message);
  }
  return payload;
}

export function registerTheaterTools(
  context: NonNullable<Document["modelContext"]>,
  execute: (name: TheaterToolName, input: Record<string, unknown>) => Promise<unknown>,
): string[] {
  const existing = new Set((context.getTools?.() ?? []).map((tool) => tool.name));

  for (const tool of THEATER_TOOLS) {
    if (existing.has(tool.name)) {
      continue;
    }
    context.registerTool({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      execute: (input) => execute(tool.name, input),
    });
    existing.add(tool.name);
  }

  return THEATER_TOOLS.map((tool) => tool.name);
}

export function discoverRegisteredToolNames(context: NonNullable<Document["modelContext"]>): string[] {
  return (context.getTools?.() ?? []).map((tool) => tool.name);
}
