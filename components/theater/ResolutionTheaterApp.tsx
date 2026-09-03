"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TheaterWebMcp } from "@/components/theater/TheaterWebMcp";
import { THEATER_STATE_EVENT, THEATER_WEBMCP_EVENT, type TheaterToolPulse } from "@/components/theater/pulse";
import { formatEuro } from "@/lib/utils";
import type { TheaterSnapshot, TheaterWorkItemSnapshot } from "@/src/domain/theater/types";

function agentPrompt() {
  return [
    "Discover the page tools with getTools.",
    "Call list_work_items.",
    "For each item: inspect_counter → compute_entitlement → prepare_filing → request_signature.",
    "Then execute_filing and verify_filing for every item the human approves.",
    "If a tool fails, report the error code and do not claim success without verification.",
  ].join(" ");
}

async function fetchSession(method: "GET" | "POST") {
  const response = await fetch("/api/demo/theater/session", { method });
  const payload = (await response.json()) as { theater?: TheaterSnapshot; error?: { message?: string } };
  if (!response.ok || !payload.theater) {
    throw new Error(payload.error?.message ?? "Could not open the theater.");
  }
  return payload.theater;
}

export function ResolutionTheaterApp() {
  const [theater, setTheater] = useState<TheaterSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [webmcp, setWebmcp] = useState({ ready: false, reason: "Checking WebMCP…" });
  const [tape, setTape] = useState<TheaterToolPulse[]>([]);
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const applyTheater = useCallback((next: TheaterSnapshot) => {
    setTheater(next);
    setSelectedId((current) => current ?? next.items[0]?.id ?? null);
  }, []);

  async function openSession(reset = false) {
    setPending(reset ? "reset" : "open");
    setLoadError(null);
    setActionError(null);
    try {
      if (!reset) {
        const response = await fetch("/api/demo/theater/session", { method: "GET" });
        if (response.status === 404) {
          const created = await fetchSession("POST");
          applyTheater(created);
          return;
        }
        const payload = (await response.json()) as { theater?: TheaterSnapshot; error?: { message?: string } };
        if (!response.ok || !payload.theater) {
          throw new Error(payload.error?.message ?? "Could not open the theater.");
        }
        applyTheater(payload.theater);
        return;
      }

      const created = await fetchSession("POST");
      applyTheater(created);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not open the theater.");
    } finally {
      setPending(null);
    }
  }

  useEffect(() => {
    void openSession(false);
  }, []);

  useEffect(() => {
    function onState(event: Event) {
      const detail = (event as CustomEvent<TheaterSnapshot>).detail;
      if (detail) {
        applyTheater(detail);
      }
    }
    function onPulse(event: Event) {
      const detail = (event as CustomEvent<TheaterToolPulse>).detail;
      if (detail) {
        setTape((current) => [detail, ...current].slice(0, 18));
      }
    }
    window.addEventListener(THEATER_STATE_EVENT, onState);
    window.addEventListener(THEATER_WEBMCP_EVENT, onPulse);
    return () => {
      window.removeEventListener(THEATER_STATE_EVENT, onState);
      window.removeEventListener(THEATER_WEBMCP_EVENT, onPulse);
    };
  }, [applyTheater]);

  const prompt = useMemo(() => agentPrompt(), []);

  async function copyPrompt() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function decide(workItemId: string, decision: "approved" | "denied") {
    setPending(`decide:${decision}`);
    setActionError(null);
    try {
      const response = await fetch("/api/demo/theater/session/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workItemId, decision }),
      });
      const payload = (await response.json()) as { theater?: TheaterSnapshot; error?: { message?: string } };
      if (!response.ok || !payload.theater) {
        throw new Error(payload.error?.message ?? "Signature decision failed.");
      }
      applyTheater(payload.theater);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Signature decision failed.");
    } finally {
      setPending(null);
    }
  }

  if (loadError) {
    return (
      <main className="chamber-root flex min-h-screen items-center justify-center px-6">
        <div className="max-w-lg border border-[#e8b84a]/40 bg-[#0b1f3a] p-8 text-[#f4efe4]">
          <p className="font-[family-name:var(--font-board)] text-sm tracking-[0.28em] text-[#e8b84a]">
            THEATER CLOSED
          </p>
          <p className="mt-4 text-lg">{loadError}</p>
          <button
            type="button"
            className="mt-6 border border-[#e8b84a] px-4 py-2 text-sm text-[#e8b84a]"
            onClick={() => void openSession(true)}
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (!theater) {
    return (
      <main className="chamber-root flex min-h-screen items-center justify-center text-[#e8b84a]">
        <p className="font-[family-name:var(--font-board)] tracking-[0.32em]">ISSUING WORK ITEMS…</p>
      </main>
    );
  }

  const selected = theater.items.find((item) => item.id === selectedId) ?? theater.items[0];
  const awaiting = theater.items.filter((item) => item.status === "AWAITING_SIGNATURE");

  if (!selected) {
    return (
      <main className="chamber-root flex min-h-screen items-center justify-center text-[#e8b84a]">
        <p className="font-[family-name:var(--font-board)] tracking-[0.32em]">NO WORK ITEMS</p>
      </main>
    );
  }

  return (
    <main className="chamber-root min-h-screen text-[#f4efe4]">
      <TheaterWebMcp onStatus={(ready, reason) => setWebmcp({ ready, reason })} />

      <header className="border-b border-[#e8b84a]/25 bg-[#071525] px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-[family-name:var(--font-board)] text-xs tracking-[0.34em] text-[#e8b84a]">
              RESOLUTION THEATER · MULTI-COUNTER
            </p>
            <h1 className="mt-1 font-[family-name:var(--font-board)] text-4xl uppercase leading-none tracking-wide sm:text-5xl">
              One desk. Three disputes. Signed reality.
            </h1>
          </div>
          <p className={`max-w-md text-sm ${webmcp.ready ? "text-[#9dffa1]" : "text-[#ffb4a8]"}`}>
            {webmcp.reason}
          </p>
        </div>
      </header>

      <section className="border-b border-[#e8b84a]/20 bg-[#e8b84a] px-4 py-3 text-[#0b1f3a] sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-sm leading-relaxed">
            Open this URL in <strong>ChatGPT’s in-app browser</strong>. Tell the agent:
            <span className="mt-1 block font-mono text-[13px] font-medium">“{prompt}”</span>
          </p>
          <button
            type="button"
            onClick={() => void copyPrompt()}
            className="shrink-0 bg-[#0b1f3a] px-4 py-2 text-sm text-[#e8b84a]"
          >
            {copied ? "Copied" : "Copy prompt"}
          </button>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-0 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="bg-[#ede6d6] text-[#1a1714]">
          <div className="border-b border-dashed border-[#1a1714]/30 px-6 py-5 sm:px-8">
            <p className="font-[family-name:var(--font-board)] text-xs tracking-[0.3em] text-[#8a3b12]">
              WORK ITEMS
            </p>
            <p className="mt-2 max-w-xl text-sm text-[#5c5348]">
              The agent cannot “win” here. It must inspect the counter, compute deterministic entitlement, request a
              signature, execute, and verify by re-reading provider state.
            </p>
          </div>

          <div className="space-y-4 px-6 py-6 sm:px-8">
            <ol className="space-y-2">
              {theater.items.map((item) => (
                <WorkItemRow
                  key={item.id}
                  item={item}
                  active={item.id === selected.id}
                  onSelect={() => setSelectedId(item.id)}
                />
              ))}
            </ol>

            <div className="border-t border-[#1a1714]/15 pt-5">
              <p className="text-xs uppercase tracking-[0.2em] text-[#8a3b12]">Approval queue</p>
              {awaiting.length === 0 ? (
                <p className="mt-2 text-sm text-[#5c5348]">Empty. Ask the agent to request_signature on prepared filings.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {awaiting.map((item) => (
                    <li key={item.id} className="border border-[#1a1714]/20 bg-white/70 p-3">
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="mt-1 font-mono text-xs text-[#5c5348]">
                        Prepared: {item.proposal?.toolName ?? "—"} · {formatEuro(item.proposal?.amount)}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="bg-[#1a1714] px-3 py-2 text-sm text-[#ede6d6] disabled:opacity-40"
                          disabled={Boolean(pending)}
                          onClick={() => void decide(item.id, "approved")}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="border border-[#1a1714] px-3 py-2 text-sm disabled:opacity-40"
                          disabled={Boolean(pending)}
                          onClick={() => void decide(item.id, "denied")}
                        >
                          Deny
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {actionError ? <p className="mt-3 text-sm text-[#9b1c1c]">{actionError}</p> : null}
            </div>
          </div>
        </section>

        <section className="border-t border-[#e8b84a]/20 bg-[#0b1f3a] lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-5 sm:px-8">
            <div>
              <p className="font-[family-name:var(--font-board)] text-xs tracking-[0.3em] text-[#e8b84a]">
                DESK VIEW
              </p>
              <p className="font-[family-name:var(--font-board)] text-3xl uppercase tracking-wide">
                {selected.title}
              </p>
            </div>
            <button
              type="button"
              className="font-mono text-[11px] text-white/50"
              disabled={Boolean(pending)}
              onClick={() => void openSession(true)}
            >
              {pending === "reset" ? "Issuing…" : "Fresh session"}
            </button>
          </div>

          <div className="space-y-5 px-6 py-6 sm:px-8">
            <DeskBlock label="State" value={selected.status} />
            <DeskBlock
              label="Entitlement"
              value={
                selected.entitlement
                  ? `${selected.entitlement.outcome} · ${formatEuro(selected.entitlement.amount)}`
                  : "—"
              }
              note={selected.entitlement?.reasons?.[0] ?? "Run inspect_counter then compute_entitlement."}
            />
            <DeskBlock
              label="Prepared"
              value={
                selected.proposal
                  ? `${selected.proposal.toolName} · ${formatEuro(selected.proposal.amount)}`
                  : "—"
              }
            />

            {selected.proposal ? (
              <pre className="overflow-x-auto border border-white/10 bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-white/80">
                {JSON.stringify(selected.proposal.payload, null, 2)}
              </pre>
            ) : null}

            {selected.verification ? (
              <p
                className={`border px-3 py-2 text-sm ${
                  selected.verification.matched
                    ? "border-[#9dffa1]/40 bg-[#9dffa1]/10 text-[#9dffa1]"
                    : "border-[#ffb4a8]/40 text-[#ffb4a8]"
                }`}
              >
                {selected.verification.matched ? "Verified." : "Verification mismatch. Not marked successful."}
              </p>
            ) : null}
          </div>
        </section>
      </div>

      <section className="border-t border-[#e8b84a]/20 bg-[#050d18] px-4 py-5 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-[family-name:var(--font-board)] text-xs tracking-[0.28em] text-[#e8b84a]">
              TOOL TAPE · LIVE WEBMCP
            </p>
          </div>
          {tape.length === 0 ? (
            <p className="mt-3 font-mono text-sm text-white/35">
              Waiting for a tool call. list_work_items · inspect_counter · compute_entitlement · prepare_filing · request_signature · execute_filing · verify_filing
            </p>
          ) : (
            <ol className="mt-3 space-y-1 font-mono text-sm">
              {tape.map((entry) => (
                <li
                  key={`${entry.at}-${entry.name}`}
                  className={entry.ok ? "text-[#9dffa1]" : "text-[#ffb4a8]"}
                  title={entry.requestId ? `requestId: ${entry.requestId}` : undefined}
                >
                  {entry.name} — {entry.message}
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </main>
  );
}

function WorkItemRow({
  item,
  active,
  onSelect,
}: {
  item: TheaterWorkItemSnapshot;
  active: boolean;
  onSelect: () => void;
}) {
  const identity =
    item.identity.providerId === "flyright"
      ? `${item.identity.locator} / ${item.identity.lastName}`
      : item.identity.providerId === "streamly"
        ? `${item.identity.subscriptionId} / ${item.identity.accountEmail}`
        : `${item.identity.orderId} / ${item.identity.lastName}`;

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`w-full border px-4 py-3 text-left transition ${
          active ? "border-[#8a3b12] bg-white/80" : "border-[#1a1714]/20 bg-white/60 hover:bg-white/80"
        }`}
      >
        <p className="text-sm font-medium">{item.title}</p>
        <p className="mt-1 font-mono text-[11px] text-[#5c5348]">{identity}</p>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[#8a3b12]">
          {item.providerId} · {item.status.replaceAll("_", " ").toLowerCase()}
        </p>
      </button>
    </li>
  );
}

function DeskBlock({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="border-b border-white/10 pb-3">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/45">{label}</p>
      <p className="mt-2 font-[family-name:var(--font-board)] text-3xl text-[#e8b84a]">{value}</p>
      {note ? <p className="mt-2 text-sm text-white/65">{note}</p> : null}
    </div>
  );
}

