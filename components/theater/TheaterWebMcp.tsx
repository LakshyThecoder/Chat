"use client";

import { useEffect, useRef, useState } from "react";
import { THEATER_STATE_EVENT, pulseTheaterTool } from "@/components/theater/pulse";
import type { TheaterSnapshot } from "@/src/domain/theater/types";

const noInputSchema = { type: "object", additionalProperties: false, properties: {} } as const;

async function runTool(name: string, input: Record<string, unknown>) {
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

  if (!response.ok) {
    const message = payload.error?.message ?? `${name} failed`;
    pulseTheaterTool({
      name,
      ok: false,
      message,
      at: new Date().toISOString(),
      input,
      output: payload,
      requestId: payload.error?.requestId,
    });
    if (payload.theater) {
      window.dispatchEvent(new CustomEvent(THEATER_STATE_EVENT, { detail: payload.theater }));
    }
    throw new Error(message);
  }

  pulseTheaterTool({
    name,
    ok: true,
    message: `${name} wrote into this page`,
    at: new Date().toISOString(),
    input,
    output: payload,
    requestId: payload.error?.requestId,
  });
  if (payload.theater) {
    window.dispatchEvent(new CustomEvent(THEATER_STATE_EVENT, { detail: payload.theater }));
  }
  return payload;
}

export function TheaterWebMcp({
  onStatus,
}: {
  onStatus: (ready: boolean, reason: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;

    const context = document.modelContext;
    if (!context?.registerTool) {
      onStatusRef.current(
        false,
        "WebMCP is off in this browser. Open this URL in ChatGPT’s in-app browser, or Chrome 149+ with chrome://flags/#enable-webmcp-testing.",
      );
      return;
    }

    const registerTool = context.registerTool.bind(context);

    registerTool({
      name: "list_work_items",
      description: "List the theater work items and their current states.",
      inputSchema: noInputSchema,
      execute: () => runTool("list_work_items", {}),
    });

    registerTool({
      name: "get_work_item",
      description: "Read one theater work item by workItemId.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["workItemId"],
        properties: {
          workItemId: { type: "string", description: "Work item id from list_work_items." },
        },
      },
      execute: (input) => runTool("get_work_item", input),
    });

    registerTool({
      name: "inspect_counter",
      description:
        "Inspect the provider counter for one work item and paint the observed counter state onto the page. Read-only.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["workItemId"],
        properties: { workItemId: { type: "string" } },
      },
      execute: (input) => runTool("inspect_counter", input),
    });

    registerTool({
      name: "compute_entitlement",
      description:
        "Compute deterministic entitlement from the observed provider state and published policy. Does not submit anything.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["workItemId"],
        properties: { workItemId: { type: "string" } },
      },
      execute: (input) => runTool("compute_entitlement", input),
    });

    registerTool({
      name: "prepare_filing",
      description:
        "Prepare a single high-impact filing proposal for a work item (tool name, payload, amount, idempotency key, expected verification). Does not execute.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["workItemId"],
        properties: { workItemId: { type: "string" } },
      },
      execute: (input) => runTool("prepare_filing", input),
    });

    registerTool({
      name: "request_signature",
      description:
        "Request the human signature for a prepared filing. After this, execution may proceed only if the human approves.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["workItemId"],
        properties: { workItemId: { type: "string" } },
      },
      execute: (input) => runTool("request_signature", input),
    });

    registerTool({
      name: "execute_filing",
      description:
        "Execute an approved filing for a work item. Fails if unsigned/denied or if the prepared amount differs from the signed amount. Mutation is idempotent.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["workItemId"],
        properties: { workItemId: { type: "string" } },
      },
      execute: (input) => runTool("execute_filing", input),
    });

    registerTool({
      name: "verify_filing",
      description:
        "Re-read provider state and verify that it matches the expected transition. Marks the work item verified or failed.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["workItemId"],
        properties: { workItemId: { type: "string" } },
      },
      execute: (input) => runTool("verify_filing", input),
    });

    onStatusRef.current(true, "WebMCP tools are registered on this page. The desk moves when they run.");
  }, [mounted]);

  return null;
}

