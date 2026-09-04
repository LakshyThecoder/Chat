"use client";

import { formatMoney } from "@/lib/utils";
import { bookingFromCounter, claimExists } from "@/src/domain/flight-desk/rights-from-item";
import type { TheaterWorkItemSnapshot } from "@/src/domain/theater/types";

export function FlyRightDrawer({
  item,
  open,
  onClose,
}: {
  item: TheaterWorkItemSnapshot | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  const booking = bookingFromCounter(item?.counter ?? null);
  const claimed = item ? claimExists(item.counter) || item.catalogBlocked : false;
  const identity = item?.identity.providerId === "flyright" ? item.identity : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/55" role="dialog" aria-modal="true" aria-labelledby="flyright-heading">
      <button type="button" className="h-full flex-1 cursor-default" aria-label="Close FlyRight" onClick={onClose} />
      <aside className="h-full w-full max-w-md overflow-auto border-l border-[var(--line)] bg-[var(--night)] px-6 py-8">
        <p className="text-sm text-[var(--mist)]">Airline counter</p>
        <h2 id="flyright-heading" className="font-display text-4xl italic">
          FlyRight
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--mist)]">
          A live sandbox row. ChatGPT can use this counter’s own tools in another tab.
        </p>
        {!item ? (
          <p className="mt-6 text-sm text-[var(--mist)]">Inspect a booking first.</p>
        ) : (
          <dl className="mt-8 space-y-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--mist)]">Locator</dt>
              <dd className="font-board text-xl tracking-wide">{identity?.locator ?? booking?.locator}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--mist)]">Passenger</dt>
              <dd>{identity?.lastName ?? booking?.lastName}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--mist)]">Route</dt>
              <dd>
                {booking?.origin ?? "—"}–{booking?.destination ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--mist)]">Fare</dt>
              <dd>{formatMoney(booking?.farePaid, booking?.currency ?? "EUR")}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--mist)]">Claim</dt>
              <dd>{claimed ? "Already on file" : "None"}</dd>
            </div>
            {item.verification ? (
              <p className="pt-2 text-lg" style={{ color: item.verification.matched ? "#8fd9c0" : "var(--notam)" }}>
                {item.verification.matched ? "Matched the signed amount." : "The row does not match."}
              </p>
            ) : null}
          </dl>
        )}
        <div className="mt-10 flex flex-wrap gap-2">
          <a className="desk-btn desk-btn-solid" href="/providers/flyright">
            Open FlyRight tools
          </a>
          <button type="button" className="desk-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </aside>
    </div>
  );
}
