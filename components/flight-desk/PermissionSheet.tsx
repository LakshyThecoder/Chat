"use client";

import { formatMoney } from "@/lib/utils";
import type { TheaterWorkItemSnapshot } from "@/src/domain/theater/types";

export function PermissionSheet({
  items,
  pending,
  error,
}: {
  items: TheaterWorkItemSnapshot[];
  pending: string | null;
  error: string | null;
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
  onFileUnsigned: (id: string) => void;
}) {
  const awaiting = items.filter((item) => item.status === "AWAITING_SIGNATURE" && !item.catalogBlocked);
  const verified = items.find((item) => item.status === "VERIFIED" && item.verification?.matched);

  return (
    <section className="desk-card px-5 py-5" aria-labelledby="keep-heading">
      <h2 id="keep-heading" className="font-display text-2xl italic">
        You keep 100%
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--mist)]">
        No commission is deducted. You sign the exact amount before Aegis can touch the carrier. The model never
        grants itself permission.
      </p>
      {awaiting.length > 0 ? (
        <p className="mt-4 text-sm">
          Waiting for your signature on{" "}
          <strong>
            {formatMoney(
              awaiting[0]?.proposal?.amount ?? awaiting[0]?.entitlement?.amount,
              awaiting[0]?.proposal?.currency ?? "EUR",
            )}
          </strong>
          . Sign on the flight board above.
        </p>
      ) : verified ? (
        <p className="mt-4 text-sm font-semibold text-[var(--green)]">
          Carrier row matched the signed amount. That is the only definition of success.
        </p>
      ) : (
        <p className="mt-4 text-sm text-[var(--mist)]">
          {pending ? "Working…" : "No signature waiting. Begin resolution, or let ChatGPT do it."}
        </p>
      )}
      {error ? (
        <p className="mt-3 text-sm text-[#f0b4aa]" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
