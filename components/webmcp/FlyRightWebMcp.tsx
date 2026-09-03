"use client";

import { useEffect, useState } from "react";

async function callFlyRight(tool: string, input: Record<string, unknown>) {
  const response = await fetch(`/api/providers/flyright?tool=${encodeURIComponent(tool)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = (await response.json()) as { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `FlyRight ${tool} failed`);
  }
  return payload;
}

export function FlyRightWebMcp() {
  const [ready, setReady] = useState(false);
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) {
      setReason("Open this page in ChatGPT’s in-app browser or Chrome with WebMCP enabled.");
      return;
    }

    const lookup = {
      type: "object",
      additionalProperties: false,
      required: ["locator", "lastName"],
      properties: {
        locator: { type: "string", description: "Booking locator, e.g. FR1842" },
        lastName: { type: "string", description: "Passenger last name" },
      },
    };

    context.registerTool({
      name: "get_booking",
      description: "Look up a FlyRight booking by locator and last name.",
      inputSchema: lookup,
      execute: (input) => callFlyRight("get_booking", input),
    });
    context.registerTool({
      name: "get_flight_status",
      description: "Read the current FlyRight flight status for a booking.",
      inputSchema: lookup,
      execute: (input) => callFlyRight("get_flight_status", input),
    });
    context.registerTool({
      name: "get_policy",
      description: "Read the published FlyRight unused-fare cancellation policy.",
      inputSchema: { type: "object", additionalProperties: false, properties: {} },
      execute: () => callFlyRight("get_policy", {}),
    });
    context.registerTool({
      name: "calculate_compensation",
      description: "Calculate the unused-fare refund from live booking and policy. Does not submit a claim.",
      inputSchema: lookup,
      execute: (input) => callFlyRight("calculate_compensation", input),
    });
    context.registerTool({
      name: "get_claim_status",
      description: "Read a FlyRight claim by claimId or booking locator.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          claimId: { type: "string" },
          locator: { type: "string" },
        },
      },
      execute: (input) => callFlyRight("get_claim_status", input),
    });
    context.registerTool({
      name: "submit_claim",
      description: "File a FlyRight unused-fare claim. Idempotent. Fails if ineligible or already claimed.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["locator", "lastName", "amount", "idempotencyKey"],
        properties: {
          locator: { type: "string" },
          lastName: { type: "string" },
          amount: { type: "string" },
          currency: { type: "string" },
          idempotencyKey: { type: "string" },
        },
      },
      execute: (input) => callFlyRight("submit_claim", input),
    });
    context.registerTool({
      name: "request_follow_up",
      description: "Ask FlyRight to resume review of a claim that needs information.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["claimId"],
        properties: { claimId: { type: "string" } },
      },
      execute: (input) => callFlyRight("request_follow_up", input),
    });

    setReady(true);
  }, []);

  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/70">
      {ready ? "WebMCP tools registered on this page" : reason ?? "Checking WebMCP…"}
    </p>
  );
}
