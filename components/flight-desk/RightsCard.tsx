"use client";

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

  return (
    <section className="desk-card px-5 py-5" aria-labelledby="why-heading">
      <h2 id="why-heading" className="font-display text-2xl italic">
        Why this number
      </h2>
      {!item || !rights ? (
        <p className="mt-2 text-sm text-[var(--mist)]">
          Inspect the booking or ask ChatGPT to begin. The amount will come from the row, not from a guess.
        </p>
      ) : (
        <>
          <p className="mt-2 font-mono text-xs text-[var(--mist)]">{filing?.ruleIds[0] ?? "—"}</p>
          <ul className="mt-4 space-y-2 text-sm leading-relaxed text-[var(--mist)]">
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
