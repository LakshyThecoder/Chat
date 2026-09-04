"use client";

import { formatMoney } from "@/lib/utils";
import type { PassengerRightsDecision } from "@/src/domain/eligibility/types";
import type { TheaterWorkItemSnapshot } from "@/src/domain/theater/types";

export function RightsCard({
  item,
  rights,
}: {
  item: TheaterWorkItemSnapshot | null;
  rights: PassengerRightsDecision | null;
}) {
  const filing = item?.entitlement ?? rights?.filing;
  const reasons = filing?.reasons ?? rights?.filing.reasons ?? [];
  const lines = rights?.lines ?? [];

  return (
    <section className="desk-card px-5 py-5" aria-labelledby="why-heading">
      <div className="flex items-end justify-between gap-3">
        <h2 id="why-heading" className="font-display text-2xl italic">
          Why this number
        </h2>
        {rights?.distanceKm ? (
          <p className="font-mono text-[11px] font-bold text-[var(--muted)]">{rights.distanceKm} km</p>
        ) : null}
      </div>

      {!rights ? (
        <p className="mt-2 text-sm text-[var(--mist)]">
          Inspect the booking or ask ChatGPT to begin. The amount will come from the row, not from a guess.
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-2">
            {lines.length > 0 ? (
              lines.map((line) => (
                <div
                  key={`${line.kind}-${line.regime}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[#f8f9f6] px-3 py-3"
                >
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">
                      {line.regime} · {line.kind.replaceAll("_", " ")}
                    </p>
                    <p className="mt-1 text-sm font-bold capitalize">{line.decision.outcome}</p>
                  </div>
                  <p className="text-lg font-extrabold tracking-[-0.03em]">
                    {line.decision.outcome === "eligible"
                      ? formatMoney(line.decision.amount, line.decision.currency)
                      : "—"}
                  </p>
                </div>
              ))
            ) : (
              <p className="font-mono text-xs text-[var(--mist)]">{filing?.ruleIds[0] ?? "—"}</p>
            )}
          </div>

          <ul className="mt-4 space-y-2 text-sm leading-relaxed text-[var(--mist)]">
            {reasons.map((reason) => (
              <li key={reason} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-[var(--blue)]" aria-hidden />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
