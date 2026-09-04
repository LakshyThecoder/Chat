"use client";

import type { AirlineMailThread } from "@/src/domain/flight-desk/inbox-catalog";
import { isFlyRightItem } from "@/src/domain/flight-desk/rights-from-item";
import type { TheaterWorkItemSnapshot } from "@/src/domain/theater/types";

export function TravelGraph({
  items,
  watched,
  selectedId,
  onSelectItem,
}: {
  items: TheaterWorkItemSnapshot[];
  watched: AirlineMailThread[];
  selectedId: string | null;
  onSelectItem: (id: string) => void;
}) {
  const flights = items.filter(isFlyRightItem);

  return (
    <section aria-labelledby="graph-heading">
      <h2 id="graph-heading" className="font-display text-3xl italic">
        Trips
      </h2>
      <p className="mt-1 text-sm text-[var(--mist)]">Reconstructed from mail and the live FlyRight row.</p>
      <ul className="mt-4 space-y-2">
        {flights.map((item) => {
          const identity = item.identity.providerId === "flyright" ? item.identity : null;
          const active = item.id === selectedId;
          return (
            <li key={item.id}>
              <button
                type="button"
                className={`flex w-full items-baseline justify-between gap-3 border px-3 py-2 text-left ${
                  active ? "border-[var(--sodium)] bg-[var(--sodium)]/10" : "border-[var(--line)] hover:bg-white/[0.03]"
                }`}
                onClick={() => onSelectItem(item.id)}
              >
                <span className="font-board text-xl tracking-wide">{identity?.locator}</span>
                <span className="text-sm text-[var(--mist)]">
                  {item.catalogBlocked ? "Do not file" : item.status.replaceAll("_", " ").toLowerCase()}
                </span>
              </button>
            </li>
          );
        })}
        {watched.map((thread) => (
          <li
            key={thread.id}
            className="flex items-baseline justify-between border border-dashed border-[var(--line)] px-3 py-2"
          >
            <span className="font-board text-xl tracking-wide">{thread.flightNumber}</span>
            <span className="text-sm text-[var(--sodium)]">
              {thread.origin}–{thread.destination} from a sale email
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
