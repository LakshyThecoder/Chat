"use client";

import { ledgerCopy } from "@/src/domain/theater/ledger";
import type { TheaterToolPulse } from "@/components/theater/pulse";

export function AgentTape({ tape }: { tape: TheaterToolPulse[] }) {
  return (
    <section className="desk-card px-5 py-5" aria-labelledby="tape-heading" aria-live="polite">
      <h2 id="tape-heading" className="font-display text-2xl italic">
        ChatGPT, on this page
      </h2>
      {tape.length === 0 ? (
        <p className="mt-2 text-sm leading-relaxed text-[var(--mist)]">
          Say “Check my airline email and tell me what I’m owed.” Tools will move the board you are looking at.
        </p>
      ) : (
        <ol className="mt-4 max-h-56 space-y-3 overflow-auto">
          {tape.map((entry, index) => {
            const copy = ledgerCopy({ name: entry.name, ok: entry.ok, code: entry.code });
            return (
              <li key={`${entry.at}-${entry.name}-${index}`}>
                <p className="text-sm" style={{ color: entry.ok ? "var(--chart)" : "var(--notam)" }}>
                  {copy.headline}
                </p>
                <p className="font-mono text-[10px] text-[var(--mist)]">{entry.name}</p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
