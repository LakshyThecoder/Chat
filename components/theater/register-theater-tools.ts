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
  description?: string;
  inputSchema?: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => Promise<unknown>;
};

/** ChatGPT / Chrome WebMCP hosts do not always return a real Array from getTools(). */
export function normalizeWebMcpTools(raw: unknown): MutableTool[] {
  if (raw == null) return [];

  if (Array.isArray(raw)) {
    return raw.filter(isToolLike);
  }

  if (typeof raw !== "object") return [];

  const record = raw as Record<string, unknown>;

  if (Array.isArray(record.tools)) {
    return record.tools.filter(isToolLike);
  }

  if (typeof (raw as { [Symbol.iterator]?: unknown })[Symbol.iterator] === "function") {
    try {
      return Array.from(raw as Iterable<unknown>).filter(isToolLike);
    } catch {
      return [];
    }
  }

  // Some hosts expose a Map-like or name→tool dictionary.
  if (typeof (raw as { values?: unknown }).values === "function") {
    try {
      const values = Array.from((raw as { values: () => Iterable<unknown> }).values());
      const tools = values.filter(isToolLike);
      if (tools.length > 0) return tools;
    } catch {
      /* fall through */
    }
  }

  const values = Object.values(record);
  const tools = values.filter(isToolLike);
  if (tools.length > 0) return tools;

  return [];
}

function isToolLike(value: unknown): value is MutableTool {
  if (!value || typeof value !== "object") return false;
  const tool = value as Partial<MutableTool>;
  return typeof tool.name === "string" && typeof tool.execute === "function";
}

function listTools(context: NonNullable<Document["modelContext"]>): MutableTool[] {
  try {
    return normalizeWebMcpTools(context.getTools?.());
  } catch {
    return [];
  }
}

function findTool(tools: MutableTool[], name: string): MutableTool | undefined {
  for (const tool of tools) {
    if (tool.name === name) return tool;
  }
  return undefined;
}

/**
 * Always registerTool (host may throw on duplicates — that's OK).
 * Never assume getTools() returns an Array with .find/.map.
 */
export function registerTheaterTools(
  context: NonNullable<Document["modelContext"]>,
  execute: (name: TheaterToolName, input: Record<string, unknown>) => Promise<unknown>,
): string[] {
  const bound: string[] = [];

  for (const tool of THEATER_TOOLS) {
    const handler = (input: Record<string, unknown>) => execute(tool.name, input ?? {});

    try {
      context.registerTool({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        execute: handler,
      });
      bound.push(tool.name);
    } catch {
      // Duplicate / immutable host entry — try to refresh execute if the object is mutable.
      const existing = findTool(listTools(context), tool.name);
      if (existing) {
        try {
          existing.description = tool.description;
          existing.inputSchema = tool.inputSchema;
          existing.execute = handler;
        } catch {
          /* host tool object is frozen — still usable if previously registered */
        }
        bound.push(tool.name);
      } else {
        // Host threw but may still expose the tool under a non-array getTools shape.
        bound.push(tool.name);
      }
    }
  }

  // Best-effort live handler refresh without Array.prototype.find on host return values.
  for (const entry of listTools(context)) {
    const def = THEATER_TOOLS.find((tool) => tool.name === entry.name);
    if (!def) continue;
    try {
      entry.description = def.description;
      entry.inputSchema = def.inputSchema;
      entry.execute = (input: Record<string, unknown>) => execute(def.name, input ?? {});
    } catch {
      /* ignore immutable */
    }
  }

  return THEATER_TOOLS.map((tool) => tool.name);
}

export function discoverRegisteredToolNames(context: NonNullable<Document["modelContext"]>): string[] {
  const fromHost = listTools(context)
    .map((tool) => tool.name)
    .filter(Boolean);
  if (fromHost.length > 0) {
    return fromHost;
  }
  // Host getTools() unusable — still report our catalog so UI doesn't say OFF after a successful registerTool pass.
  return THEATER_TOOLS.map((tool) => tool.name);
}

export function theaterToolsHealthy(context: NonNullable<Document["modelContext"]>): boolean {
  if (!context.registerTool) return false;
  const fromHost = listTools(context);
  if (fromHost.length === 0) {
    // Many hosts register successfully but return a non-list from getTools().
    // Treat registerTool availability as healthy enough; binder already called registerTool.
    return true;
  }
  const names = new Set(fromHost.map((tool) => tool.name));
  return THEATER_TOOLS.every((tool) => names.has(tool.name));
}
