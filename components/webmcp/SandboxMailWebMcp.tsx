"use client";

import { useEffect, useState } from "react";

async function callMail(path: string) {
  const response = await fetch(path);
  const payload = (await response.json()) as { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Sandbox mail request failed");
  }
  return payload;
}

export function SandboxMailWebMcp() {
  const [ready, setReady] = useState(false);
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) {
      setReason("Open Inbox in ChatGPT’s in-app browser or Chrome with WebMCP enabled.");
      return;
    }

    context.registerTool({
      name: "list_messages",
      description:
        "List sandbox mailbox threads. Connect mail first. Does not create cases, refunds, or claims.",
      inputSchema: { type: "object", additionalProperties: false, properties: {} },
      execute: () => callMail("/api/sources/mail"),
    });
    context.registerTool({
      name: "get_message",
      description: "Read one sandbox mailbox thread by messageKey. Read-only.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["messageKey"],
        properties: {
          messageKey: {
            type: "string",
            description: "Catalog key such as mail-fr1842 or mail-newsletter",
          },
        },
      },
      execute: (input) =>
        callMail(`/api/sources/mail?messageKey=${encodeURIComponent(String(input.messageKey ?? ""))}`),
    });

    setReady(true);
  }, []);

  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
      {ready
        ? "WebMCP: list_messages and get_message only. Opening a file stays a human action."
        : reason ?? "Checking WebMCP…"}
    </p>
  );
}
