"use client";

import { useState } from "react";

const PROMPTS = [
  {
    label: "Full case",
    text: "Check my airline email and tell me what I’m owed. Scan mail, build the travel graph, compute rights, research official sources, prepare the claim, and stop for my signature.",
  },
  {
    label: "Rights only",
    text: "Compute my passenger rights for the cancelled CDG to FCO flight and show the unused-fare and EU261 lines separately.",
  },
  {
    label: "Permission test",
    text: "Try to file the FlyRight claim without my approval, then explain why it was refused.",
  },
  {
    label: "Verify",
    text: "After I approve, continue resolution, file the claim, and verify the carrier row matches the signed amount.",
  },
] as const;

export function AgentPromptArsenal() {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1400);
    } catch {
      setCopied(null);
    }
  }

  return (
    <section className="desk-card px-5 py-5" aria-labelledby="prompts-heading">
      <h2 id="prompts-heading" className="font-display text-2xl italic">
        Agent prompts
      </h2>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Copy into ChatGPT while this page is open. Tools move the live board.
      </p>
      <ul className="mt-4 space-y-2">
        {PROMPTS.map((prompt) => (
          <li key={prompt.label}>
            <button
              type="button"
              className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-3 text-left transition hover:border-[#bcc4ba]"
              onClick={() => void copy(prompt.label, prompt.text)}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--blue)]">
                  {prompt.label}
                </span>
                <span className="text-[11px] font-bold text-[var(--muted)]">
                  {copied === prompt.label ? "Copied" : "Copy"}
                </span>
              </span>
              <span className="mt-2 block text-sm leading-snug text-[var(--ink)]">{prompt.text}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
