"use client";

import { useEffect, useState } from "react";

async function callElectroMart(tool: string, input: Record<string, unknown>) {
  const response = await fetch(`/api/providers/electromart?tool=${encodeURIComponent(tool)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = (await response.json()) as { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `ElectroMart ${tool} failed`);
  }
  return payload;
}

export function ElectroMartWebMcp() {
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
      required: ["orderId", "lastName"],
      properties: {
        orderId: { type: "string", description: "Order id, e.g. EM-4412" },
        lastName: { type: "string", description: "Customer last name" },
      },
    };

    context.registerTool({
      name: "get_order",
      description: "Look up an ElectroMart order by order id and last name.",
      inputSchema: lookup,
      execute: (input) => callElectroMart("get_order", input),
    });
    context.registerTool({
      name: "get_return_policy",
      description: "Read the published ElectroMart warranty policy.",
      inputSchema: { type: "object", additionalProperties: false, properties: {} },
      execute: () => callElectroMart("get_return_policy", {}),
    });
    context.registerTool({
      name: "get_warranty",
      description: "Read the warranty window for an ElectroMart order.",
      inputSchema: lookup,
      execute: (input) => callElectroMart("get_warranty", input),
    });
    context.registerTool({
      name: "get_case_status",
      description: "Read an ElectroMart warranty claim by claimId or orderId.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          claimId: { type: "string" },
          orderId: { type: "string" },
        },
      },
      execute: (input) => callElectroMart("get_case_status", input),
    });
    context.registerTool({
      name: "create_return",
      description: "Open a return on an ElectroMart order. Idempotent if already open.",
      inputSchema: lookup,
      execute: (input) => callElectroMart("create_return", input),
    });
    context.registerTool({
      name: "submit_warranty_claim",
      description: "File an in-warranty claim. Fails if expired, returned, or already claimed.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["orderId", "lastName", "amount", "idempotencyKey"],
        properties: {
          orderId: { type: "string" },
          lastName: { type: "string" },
          amount: { type: "string" },
          currency: { type: "string" },
          idempotencyKey: { type: "string" },
        },
      },
      execute: (input) => callElectroMart("submit_warranty_claim", input),
    });

    setReady(true);
  }, []);

  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-amber-200/80">
      {ready ? "WebMCP tools registered on this page" : reason ?? "Checking WebMCP…"}
    </p>
  );
}
