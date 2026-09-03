"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";

export default function AgentConsolePage() {
  const [tools, setTools] = useState<string[]>([]);
  const [note, setNote] = useState("Checking document.modelContext…");

  useEffect(() => {
    const context = document.modelContext;
    if (!context) {
        setNote(
          "WebMCP is not available here. Open Inbox, a case file, or a counter in ChatGPT’s in-app browser, or Chrome 149+ with chrome://flags/#enable-webmcp-testing.",
        );
      return;
    }
    const listed = context.getTools?.() ?? [];
    setTools(listed.map((tool) => tool.name));
    setNote(
      listed.length > 0
        ? "Tools discovered on this page."
        : "WebMCP is present. Open Inbox, a case file, or a counter to register tools.",
    );
  }, []);

  return (
    <AppShell
      title="Agent desk"
      subtitle="Capability discovery from the live page. Empty means no tools are registered here — we will not invent a catalog."
    >
      <section className="border border-foreground/15 bg-white p-6">
        <p className="text-sm text-muted-foreground">{note}</p>
        {tools.length > 0 ? (
          <ul className="mt-4 space-y-2 font-mono text-sm">
            {tools.map((name) => (
              <li key={name} className="border-b border-foreground/10 py-2">
                {name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 font-display text-3xl italic">No capabilities on this surface</p>
        )}
      </section>
    </AppShell>
  );
}