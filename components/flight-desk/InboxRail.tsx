"use client";

import type { AirlineMailKind, AirlineMailThread } from "@/src/domain/flight-desk/inbox-catalog";

const KIND_LABEL: Record<AirlineMailKind, string> = {
  booking: "Tkt",
  delay: "Dly",
  cancel: "Canx",
  promo: "Sale",
  offer: "Offr",
  claim: "Dup",
};

export function InboxRail({
  threads,
  selectedId,
  loading,
  error,
  onSelect,
}: {
  threads: AirlineMailThread[];
  selectedId: string | null;
  connected: boolean;
  loading: boolean;
  error: string | null;
  onSelect: (id: string) => void;
  onConnect: () => void;
}) {
  return (
    <section aria-labelledby="inbox-heading">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 id="inbox-heading" className="font-display text-3xl italic">
            Inbox
          </h2>
          <p className="text-sm text-[var(--mist)]">Airline mail, including the sale they hoped you’d ignore.</p>
        </div>
        <p className="font-mono text-xs text-[var(--mist)]">{threads.length}</p>
      </div>

      {error ? (
        <p className="text-sm text-[#f0b4aa]" role="alert">
          {error}
        </p>
      ) : null}

      {loading && threads.length === 0 ? (
        <p className="text-sm text-[var(--mist)]">Opening the mailbox…</p>
      ) : (
        <ul className="space-y-2">
          {threads.map((thread) => {
            const active = thread.id === selectedId;
            return (
              <li key={thread.id}>
                <button
                  type="button"
                  className={`ticket w-full text-left ${active ? "bg-[var(--chart)] text-[var(--chart-ink)]" : "hover:bg-white/[0.03]"}`}
                  aria-current={active ? "true" : undefined}
                  onClick={() => onSelect(thread.id)}
                >
                  <span className={`ticket-stub kind-${thread.kind}`}>{KIND_LABEL[thread.kind]}</span>
                  <span className="px-3 py-2">
                    <span className="block text-sm font-medium">{thread.subject}</span>
                    <span className={`mt-1 block text-xs ${active ? "text-[var(--chart-mute)]" : "text-[var(--mist)]"}`}>
                      {thread.fromName}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
