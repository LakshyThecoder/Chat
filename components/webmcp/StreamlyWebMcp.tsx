"use client";

import { useEffect, useState } from "react";

async function callStreamly(tool: string, input: Record<string, unknown>) {
  const response = await fetch(`/api/providers/streamly?tool=${encodeURIComponent(tool)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = (await response.json()) as { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Streamly ${tool} failed`);
  }
  return payload;
}

export function StreamlyWebMcp() {
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
      required: ["subscriptionId", "accountEmail"],
      properties: {
        subscriptionId: { type: "string", description: "Subscription id, e.g. SL-1001" },
        accountEmail: { type: "string", description: "Account email on the subscription" },
      },
    };

    context.registerTool({
      name: "get_subscription",
      description: "Look up a Streamly subscription by id and account email.",
      inputSchema: lookup,
      execute: (input) => callStreamly("get_subscription", input),
    });
    context.registerTool({
      name: "get_billing_history",
      description: "Read the last Streamly charge for a subscription.",
      inputSchema: lookup,
      execute: (input) => callStreamly("get_billing_history", input),
    });
    context.registerTool({
      name: "get_cancellation_policy",
      description: "Read the published Streamly billed-after-cancel policy.",
      inputSchema: { type: "object", additionalProperties: false, properties: {} },
      execute: () => callStreamly("get_cancellation_policy", {}),
    });
    context.registerTool({
      name: "get_case_status",
      description: "Read a Streamly refund by refundId or subscriptionId.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          refundId: { type: "string" },
          subscriptionId: { type: "string" },
        },
      },
      execute: (input) => callStreamly("get_case_status", input),
    });
    context.registerTool({
      name: "cancel_subscription",
      description: "Cancel an active Streamly plan. Idempotent if already cancelled.",
      inputSchema: lookup,
      execute: (input) => callStreamly("cancel_subscription", input),
    });
    context.registerTool({
      name: "request_refund",
      description: "Request a billed-after-cancel refund. Fails if the plan is still active or already refunded.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["subscriptionId", "accountEmail", "amount", "idempotencyKey"],
        properties: {
          subscriptionId: { type: "string" },
          accountEmail: { type: "string" },
          amount: { type: "string" },
          currency: { type: "string" },
          idempotencyKey: { type: "string" },
        },
      },
      execute: (input) => callStreamly("request_refund", input),
    });

    setReady(true);
  }, []);

  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-fuchsia-200/80">
      {ready ? "WebMCP tools registered on this page" : reason ?? "Checking WebMCP…"}
    </p>
  );
}
