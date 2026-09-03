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

type MutableTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => Promise<unknown>;
};

function listTools(context: NonNullable<Document["modelContext"]>): MutableTool[] {
  return (context.getTools?.() ?? []) as MutableTool[];
}

function patchOrRegister(
  context: NonNullable<Document["modelContext"]>,
  tool: (typeof THEATER_TOOLS)[number],
  execute: (name: TheaterToolName, input: Record<string, unknown>) => Promise<unknown>,
) {
  const handler = (input: Record<string, unknown>) => execute(tool.name, input ?? {});
  const existing = listTools(context).find((entry) => entry.name === tool.name);

  if (existing) {
    existing.description = tool.description;
    existing.inputSchema = tool.inputSchema;
    existing.execute = handler;
    return "patched" as const;
  }

  try {
    context.registerTool({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      execute: handler,
    });
    return "registered" as const;
  } catch {
    const after = listTools(context).find((entry) => entry.name === tool.name);
    if (after) {
      after.description = tool.description;
      after.inputSchema = tool.inputSchema;
      after.execute = handler;
      return "patched" as const;
    }
    throw new Error(`Could not bind ${tool.name}`);
  }
}

/**
 * Idempotent binder: register missing tools and always refresh execute handlers
 * so remounts / refresh / Strict Mode never leave ChatGPT holding dead page tools.
 */
export function registerTheaterTools(
  context: NonNullable<Document["modelContext"]>,
  execute: (name: TheaterToolName, input: Record<string, unknown>) => Promise<unknown>,
): string[] {
  for (const tool of THEATER_TOOLS) {
    patchOrRegister(context, tool, execute);
  }
  return THEATER_TOOLS.map((tool) => tool.name);
}

export function discoverRegisteredToolNames(context: NonNullable<Document["modelContext"]>): string[] {
  return listTools(context).map((tool) => tool.name);
}

export function theaterToolsHealthy(context: NonNullable<Document["modelContext"]>): boolean {
  const names = new Set(discoverRegisteredToolNames(context));
  return THEATER_TOOLS.every((tool) => names.has(tool.name));
}
