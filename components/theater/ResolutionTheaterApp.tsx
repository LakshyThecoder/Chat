"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TheaterWebMcp } from "@/components/theater/TheaterWebMcp";
import { runTheaterTool } from "@/components/theater/register-theater-tools";
import {
  THEATER_STATE_EVENT,
  THEATER_WEBMCP_EVENT,
  type TheaterToolPulse,
} from "@/components/theater/pulse";
import { ledgerCopy } from "@/src/domain/theater/ledger";
import { THEATER_TOOLS } from "@/src/domain/theater/tools";
import type { TheaterSnapshot, TheaterWorkItemSnapshot } from "@/src/domain/theater/types";
import { formatEuro } from "@/lib/utils";

function agentPrompt() {
  return "Resolve the disputes on this desk. Do not file anything I have not signed. Do not call a filing done unless verify_filing matches. One booking is already claimed — leave it blocked.";
}

async function fetchSession(method: "GET" | "POST") {
  const response = await fetch("/api/demo/theater/session", { method });
  const payload = (await response.json()) as { theater?: TheaterSnapshot; error?: { message?: string; code?: string } };
  if (!response.ok || !payload.theater) {
    throw Object.assign(new Error(payload.error?.message ?? "Could not open the desk."), {
      code: payload.error?.code,
      status: response.status,
    });
  }
  return payload.theater;
}

const PIPELINE = [
  "INSPECTED",
  "ENTITLED",
  "PREPARED",
  "AWAITING_SIGNATURE",
  "APPROVED",
  "EXECUTED",
  "VERIFIED",
] as const;

const PREPARE_STEPS = ["inspect_counter", "compute_entitlement", "prepare_filing", "request_signature"] as const;

function deskPulse(name: string) {
  return ["inspect_counter", "compute_entitlement", "execute_filing", "verify_filing"].includes(name);
}

export function ResolutionTheaterApp() {
  const [theater, setTheater] = useState<TheaterSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [webmcp, setWebmcp] = useState({ ready: false, reason: "Checking WebMCP…", tools: [] as string[] });
  const [tape, setTape] = useState<TheaterToolPulse[]>([]);
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [prepareStep, setPrepareStep] = useState<string | null>(null);

  const applyTheater = useCallback((next: TheaterSnapshot, focusId?: string) => {
    setTheater(next);
    setSelectedId((current) => focusId ?? current ?? next.items[0]?.id ?? null);
  }, []);

  async function openSession(reset = false) {
    setPending(reset ? "reset" : "open");
    setLoadError(null);
    setActionError(null);
    try {
      if (!reset) {
        const response = await fetch("/api/demo/theater/session", { method: "GET" });
        if (response.status === 404 || response.status === 409) {
          applyTheater(await fetchSession("POST"));
          return;
        }
        const payload = (await response.json()) as { theater?: TheaterSnapshot; error?: { message?: string } };
        if (!response.ok || !payload.theater) {
          throw new Error(payload.error?.message ?? "Could not open the desk.");
        }
        applyTheater(payload.theater);
        return;
      }
      applyTheater(await fetchSession("POST"));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not open the desk.");
    } finally {
      setPending(null);
    }
  }

  useEffect(() => {
    void openSession(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once on mount
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
        const focus = detail.input && typeof detail.input.workItemId === "string" ? detail.input.workItemId : undefined;
        if (focus) {
          setSelectedId(focus);
        }
        if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
          document.getElementById("counter")?.scrollIntoView({ block: "start", behavior: "smooth" });
        }
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
  const lastTool = tape[0];

  async function copyPrompt() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function decide(workItemId: string, decision: "approved" | "denied") {
    setPending(`decide:${decision}:${workItemId}`);
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
      applyTheater(payload.theater, workItemId);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Signature decision failed.");
    } finally {
      setPending(null);
    }
  }

  async function run(name: Parameters<typeof runTheaterTool>[0], workItemId: string) {
    setPending(name);
    setActionError(null);
    try {
      await runTheaterTool(name, { workItemId });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : `${name} failed.`);
    } finally {
      setPending(null);
    }
  }

  async function prepareForSignature(workItemId: string) {
    setPending("prepare");
    setActionError(null);
    try {
      for (const step of PREPARE_STEPS) {
        setPrepareStep(step);
        await runTheaterTool(step, { workItemId });
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Prepare failed.");
    } finally {
      setPrepareStep(null);
      setPending(null);
    }
  }

  async function fileSigned(workItemId: string) {
    setPending("file");
    setActionError(null);
    try {
      await runTheaterTool("execute_filing", { workItemId });
      await runTheaterTool("verify_filing", { workItemId });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Filing failed.");
    } finally {
      setPending(null);
    }
  }

  if (loadError) {
    return (
      <main className="chamber-root flex min-h-screen items-center justify-center px-6">
        <div className="max-w-lg border border-[#e8b84a]/40 bg-[#0b1f3a] p-8 text-[#f4efe4]">
          <p className="font-board text-sm tracking-[0.28em] text-[#e8b84a]">DESK CLOSED</p>
          <p className="mt-4 text-lg" role="alert">
            {loadError}
          </p>
          <p className="mt-3 text-sm text-white/60">
            The live demo needs the theater tables, FlyRight template FR1842, Streamly template SL-1001, and the FR0999
            already-claimed row.
          </p>
          <button
            type="button"
            className="theater-btn mt-6 border border-[#e8b84a] px-4 py-2 text-sm text-[#e8b84a]"
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
      <main className="chamber-root flex min-h-screen items-center justify-center text-[#e8b84a]" aria-busy="true">
        <div className="w-full max-w-6xl px-6">
          <p className="font-board tracking-[0.32em]">OPENING DESK…</p>
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <div className="h-64 bg-[#ede6d6]/20" />
            <div className="h-64 border border-[#e8b84a]/20" />
          </div>
        </div>
      </main>
    );
  }

  const selected = theater.items.find((item) => item.id === selectedId) ?? theater.items[0];
  const awaiting = theater.items.filter((item) => item.status === "AWAITING_SIGNATURE");
  const recoverable = theater.items.reduce((sum, item) => {
    const amount = Number(item.proposal?.amount ?? item.entitlement?.amount ?? 0);
    return item.catalogBlocked ? sum : sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  if (!selected) {
    return (
      <main className="chamber-root flex min-h-screen items-center justify-center text-[#e8b84a]">
        <p className="font-board tracking-[0.32em]">NO DISPUTES</p>
      </main>
    );
  }

  const signed = selected.status === "APPROVED";
  const ineligible = selected.entitlement?.outcome === "ineligible" || selected.catalogBlocked;
  const paperPulse = lastTool && !deskPulse(lastTool.name);
  const counterPulse = lastTool && deskPulse(lastTool.name);

  return (
    <main className="chamber-root min-h-screen text-[#f4efe4]" aria-busy={Boolean(pending)}>
      <a href="#disputes" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:bg-[#e8b84a] focus:px-3 focus:py-2 focus:text-[#0b1f3a]">
        Skip to disputes
      </a>
      <a href="#counter" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-16 focus:bg-[#e8b84a] focus:px-3 focus:py-2 focus:text-[#0b1f3a]">
        Skip to counter
      </a>
      <TheaterWebMcp
        onStatus={(ready, reason, tools) => setWebmcp({ ready, reason, tools })}
      />

      <header className="border-b border-[#e8b84a]/25 bg-[#071525] px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-board text-xs tracking-[0.34em] text-[#e8b84a]">AEGIS · LIVE SANDBOX ROWS</p>
            <h1 className="mt-1 text-balance font-board text-4xl uppercase leading-none tracking-wide sm:text-5xl">
              You sign. It files. The row must match.
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-white/70">
              Two people, one URL. ChatGPT inspects the live counter. You authorize money. Success is a re-read of the
              provider row — not a model saying it worked.
            </p>
          </div>
          <div className="max-w-md">
            <p
              className={`text-sm ${webmcp.ready ? "text-[#9dffa1]" : "text-[#ffb4a8]"}`}
              role="status"
              aria-live="polite"
            >
              {webmcp.ready ? "WebMCP ready" : "WebMCP off"} · {webmcp.reason}
            </p>
            {webmcp.tools.length > 0 ? (
              <p className="mt-2 font-mono text-[11px] text-white/45">{webmcp.tools.join(" · ")}</p>
            ) : null}
          </div>
        </div>
      </header>

      <section className="border-b border-[#e8b84a]/20 bg-[#e8b84a] px-4 py-3 text-[#0b1f3a] sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-board text-[11px] tracking-[0.22em]">1 BROWSER · 2 GOAL · 3 WATCH THE COUNTER MOVE</p>
            <p className="mt-1 text-sm leading-relaxed">
              Open in <strong>ChatGPT’s in-app browser</strong>. Say:
              <span className="mt-1 block font-mono text-[13px] font-medium">“{prompt}”</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => void copyPrompt()}
            className="theater-btn shrink-0 bg-[#0b1f3a] px-4 py-2 text-sm text-[#e8b84a]"
            aria-label="Copy demo goal to clipboard"
            aria-pressed={copied}
          >
            {copied ? "Copied — paste in ChatGPT" : "Copy goal"}
          </button>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-0 lg:grid-cols-[0.95fr_1.05fr]">
        <section
          id="disputes"
          className={`bg-[#ede6d6] text-[#1a1714] ${paperPulse ? "chamber-pulse" : ""}`}
        >
          <div className="border-b border-dashed border-[#1a1714]/30 px-6 py-5 sm:px-8">
            <p className="font-board text-xs tracking-[0.3em] text-[#8a3b12]">DISPUTES</p>
            <p className="mt-2 max-w-xl text-sm text-[#5c5348]">
              Money on this desk: <strong>{formatEuro(recoverable)}</strong> if both eligible rows pay. Fake brands,
              persisted rows. The agent investigates. You sign. The provider confirms.
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
              <p className="text-xs uppercase tracking-[0.2em] text-[#8a3b12]">Your signature</p>
              {awaiting.length === 0 ? (
                <p className="mt-2 text-sm text-[#5c5348]">
                  Nothing waiting. Select a dispute, or let the agent prepare one. Do not sign the blocked booking.
                </p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {awaiting.map((item) => (
                    <li key={item.id} className="border border-[#1a1714]/20 bg-white/70 p-4" aria-labelledby={`sign-${item.id}`}>
                      <p id={`sign-${item.id}`} className="text-sm font-medium">
                        {item.title}
                      </p>
                      <p className="mt-1 font-board text-5xl leading-none">{formatEuro(item.proposal?.amount)}</p>
                      <p className="mt-2 font-mono text-xs text-[#5c5348]">
                        {item.proposal?.toolName} · {identityLine(item)}
                      </p>
                      <p className="mt-2 text-sm text-[#5c5348]">{item.entitlement?.reasons[0]}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="theater-btn theater-btn-paper bg-[#1a1714] px-3 py-2 text-sm text-[#ede6d6] disabled:opacity-40"
                          disabled={Boolean(pending)}
                          onClick={() => void decide(item.id, "approved")}
                        >
                          {pending === `decide:approved:${item.id}`
                            ? "Signing…"
                            : `Sign ${formatEuro(item.proposal?.amount)}`}
                        </button>
                        <button
                          type="button"
                          className="theater-btn theater-btn-paper border border-[#1a1714] px-3 py-2 text-sm disabled:opacity-40"
                          disabled={Boolean(pending)}
                          onClick={() => void decide(item.id, "denied")}
                        >
                          {pending === `decide:denied:${item.id}` ? "Denying…" : "Deny"}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {actionError ? (
                <p className="mt-3 text-sm text-[#9b1c1c]" role="alert">
                  {actionError}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <section
          id="counter"
          className={`scroll-mt-4 border-t border-[#e8b84a]/20 bg-[#0b1f3a] lg:border-l lg:border-t-0 ${
            counterPulse ? "chamber-pulse-desk" : ""
          }`}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-5 sm:px-8">
            <div>
              <p className="font-board text-xs tracking-[0.3em] text-[#e8b84a]">COUNTER</p>
              <p className="font-board text-3xl uppercase tracking-wide">{selected.title}</p>
            </div>
            <button
              type="button"
              className="theater-btn font-mono text-[11px] text-white/50"
              disabled={Boolean(pending)}
              onClick={() => void openSession(true)}
            >
              {pending === "reset" ? "Issuing…" : "Fresh desk"}
            </button>
          </div>

          <div className="space-y-5 px-6 py-6 sm:px-8">
            <Pipeline status={selected.status} />
            <p className="text-sm text-white/70">{selected.problem}</p>
            <p className="font-mono text-[11px] text-white/40">{selected.source}</p>
            <CounterRecord item={selected} />
            <DeskBlock
              label="Engine amount"
              value={
                selected.entitlement
                  ? `${selected.entitlement.outcome} · ${formatEuro(selected.entitlement.amount)}`
                  : "—"
              }
              note={selected.entitlement?.reasons[0] ?? "Inspect the counter. Amounts come from the row, not the model."}
            />

            {ineligible ? (
              <p className="border border-[#ffb4a8]/40 px-3 py-2 text-sm text-[#ffb4a8]" role="status">
                Counter says no. Prepare and file must fail. Do not sign this one.
              </p>
            ) : null}

            {selected.status === "APPROVED" && !selected.verification ? (
              <p className="border border-[#e8b84a]/40 px-3 py-2 text-sm text-[#e8b84a]" role="status">
                Signed. The agent may now call execute_filing, then verify_filing.
              </p>
            ) : null}

            {pending === "prepare" ? (
              <p className="font-mono text-xs text-[#e8b84a]" role="status">
                Preparing: {(prepareStep ?? "inspect_counter").replaceAll("_", " ")}
              </p>
            ) : null}

            <VerificationPanel item={selected} />

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="theater-btn border border-white/30 px-3 py-2 text-sm disabled:opacity-40"
                disabled={Boolean(pending)}
                onClick={() => void run("inspect_counter", selected.id)}
              >
                {pending === "inspect_counter" ? "Looking up…" : "Look up this row"}
              </button>
              <button
                type="button"
                className="theater-btn border border-white/30 px-3 py-2 text-sm disabled:opacity-40"
                disabled={Boolean(pending) || selected.status === "VERIFIED" || selected.status === "DENIED" || ineligible}
                onClick={() => void prepareForSignature(selected.id)}
                title={ineligible ? "Blocked or ineligible — do not prepare" : undefined}
              >
                {pending === "prepare" ? "Preparing…" : "Prepare for signature"}
              </button>
              <button
                type="button"
                className="theater-btn border border-[#e8b84a]/50 px-3 py-2 text-sm text-[#e8b84a] disabled:opacity-40"
                disabled={Boolean(pending) || selected.status === "VERIFIED"}
                onClick={() => void run("execute_filing", selected.id)}
              >
                {pending === "execute_filing" ? "Filing…" : "File without signature"}
              </button>
              <button
                type="button"
                className="theater-btn bg-[#e8b84a] px-3 py-2 text-sm text-[#0b1f3a] disabled:opacity-40"
                disabled={Boolean(pending) || !signed}
                onClick={() => void fileSigned(selected.id)}
                title={!signed ? "Sign the amount first" : undefined}
              >
                {pending === "file" ? "Filing…" : "File signed claim"}
              </button>
            </div>
            {actionError ? (
              <p className="text-sm text-[#ffb4a8]" role="alert">
                {actionError}
              </p>
            ) : null}
            <p className="border border-white/10 px-3 py-2 text-xs text-white/55">
              Judge proof: File without signature must return APPROVAL_REQUIRED. File signed claim uses the same WebMCP
              tools as ChatGPT. Manual buttons are a fallback, not a bypass.
            </p>
          </div>
        </section>
      </div>

      <section className="border-t border-[#e8b84a]/20 bg-[#050d18] px-4 py-5 sm:px-8" aria-live="polite">
        <div className="mx-auto max-w-6xl">
          <p className="font-board text-xs tracking-[0.28em] text-[#e8b84a]">AGENT LEDGER · THIS PAGE</p>
          {tape.length === 0 ? (
            <p className="mt-3 font-mono text-sm text-white/35">
              Waiting for a tool call on this URL. Expected: {THEATER_TOOLS.map((tool) => tool.name).join(" · ")}
            </p>
          ) : (
            <ol className="mt-3 space-y-2">
              {tape.map((entry, index) => {
                const copy = ledgerCopy({
                  name: entry.name,
                  ok: entry.ok,
                  code: entry.code,
                });
                return (
                  <li
                    key={`${entry.at}-${entry.name}-${index}`}
                    className={`border-l-2 pl-3 ${entry.ok ? "border-[#9dffa1] text-[#9dffa1]" : "border-[#ffb4a8] text-[#ffb4a8]"}`}
                  >
                    <p className="text-sm">
                      {entry.ok ? "OK" : "ERR"}: {copy.headline}
                    </p>
                    <p className="font-mono text-[11px] text-white/45">
                      {entry.name} · {copy.detail}
                      {entry.requestId ? ` · ${entry.requestId}` : ""}
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
          <p className="mt-4 font-mono text-[11px] text-white/35">
            Probe: FR0999 / BERG stays blocked. Eligible rows are a fresh FlyRight ticket and a Streamly subscription.
          </p>
        </div>
      </section>
    </main>
  );
}

function identityLine(item: TheaterWorkItemSnapshot) {
  if (item.identity.providerId === "flyright") {
    return `${item.identity.locator} / ${item.identity.lastName}`;
  }
  if (item.identity.providerId === "streamly") {
    return `${item.identity.subscriptionId} / ${item.identity.accountEmail}`;
  }
  return `${item.identity.orderId} / ${item.identity.lastName}`;
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
  const amount = item.proposal?.amount ?? item.entitlement?.amount;
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? "true" : undefined}
        className={`theater-btn theater-btn-paper w-full border px-4 py-3 text-left transition ${
          item.catalogBlocked
            ? "border-[#9b1c1c]/40 bg-[#f8e8e4]"
            : active
              ? "border-[#8a3b12] bg-white/80"
              : "border-[#1a1714]/20 bg-white/60 hover:bg-white/80"
        }`}
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-medium">{item.title}</p>
          <p className="font-board text-2xl leading-none">{formatEuro(amount)}</p>
        </div>
        <p className="mt-1 text-xs text-[#5c5348]">{item.problem}</p>
        <p className="mt-1 font-mono text-[11px] text-[#5c5348]">{identityLine(item)}</p>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[#8a3b12]">
          {item.catalogBlocked ? "BLOCKED · " : ""}
          {item.providerId} · {item.status.replaceAll("_", " ").toLowerCase()}
        </p>
      </button>
    </li>
  );
}

function Pipeline({ status }: { status: TheaterWorkItemSnapshot["status"] }) {
  const order = ["UNINSPECTED", ...PIPELINE];
  const current = order.indexOf(status);
  const terminal =
    status === "FAILED" ? "FAILED" : status === "DENIED" ? "DENIED" : status === "EXECUTED" ? "EXECUTED" : null;
  return (
    <ol className="flex flex-wrap gap-1" aria-label="Status">
      {PIPELINE.map((step) => {
        const reached = current >= 0 && order.indexOf(step) <= current;
        const here = step === status || (step === "VERIFIED" && status === "VERIFIED");
        return (
          <li
            key={step}
            className={`px-2 py-1 font-mono text-[10px] uppercase tracking-wide ${
              here ? "bg-[#e8b84a] text-[#0b1f3a]" : reached ? "border border-white/30 text-white" : "border border-white/10 text-white/35"
            }`}
          >
            {step.replaceAll("_", " ")}
          </li>
        );
      })}
      {terminal && status !== "VERIFIED" && status !== "EXECUTED" ? (
        <li className="bg-[#ffb4a8] px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-[#0b1f3a]">
          {terminal}
        </li>
      ) : null}
    </ol>
  );
}

function CounterRecord({ item }: { item: TheaterWorkItemSnapshot }) {
  const counter = item.counter;
  if (!counter) {
    return (
      <p className="theater-empty-desk text-sm text-white/60">
        No record on the desk. Look up this row — the passenger or plan appears here.
      </p>
    );
  }

  if (item.providerId === "flyright") {
    const booking = asRecord(counter.booking);
    const claim = asRecord(counter.claim);
    if (!booking) {
      return <p className="text-sm text-white/60">Counter returned no booking.</p>;
    }
    return (
      <dl className="space-y-2 text-sm">
        <Row label="Passenger" value={`${str(booking.passengerFirstName)} ${str(booking.lastName)}`} />
        <Row label="Flight" value={`${str(booking.flightNumber)} ${str(booking.origin)}→${str(booking.destination)}`} />
        <Row label="Status" value={str(booking.flightStatus)} />
        <Row label="Fare" value={formatEuro(str(booking.farePaid))} large />
        <Row label="Claim on file" value={claim ? `${str(claim.status)} · ${formatEuro(str(claim.amount))}` : "none"} />
      </dl>
    );
  }

  if (item.providerId === "streamly") {
    const subscription = asRecord(counter.subscription);
    const refund = asRecord(counter.refund);
    if (!subscription) {
      return <p className="text-sm text-white/60">Counter returned no subscription.</p>;
    }
    return (
      <dl className="space-y-2 text-sm">
        <Row label="Plan" value={str(subscription.planName)} />
        <Row label="Status" value={str(subscription.status)} />
        <Row label="Last charge" value={formatEuro(str(subscription.lastChargeAmount))} large />
        <Row
          label="Refund on file"
          value={refund ? `${str(refund.status)} · ${formatEuro(str(refund.amount))}` : "none"}
        />
      </dl>
    );
  }

  const order = asRecord(counter.order);
  const claim = asRecord(counter.claim);
  if (!order) {
    return <p className="text-sm text-white/60">Counter returned no order.</p>;
  }
  return (
    <dl className="space-y-2 text-sm">
      <Row label="Product" value={str(order.productName)} />
      <Row label="Price" value={formatEuro(str(order.purchasePrice))} large />
      <Row label="Claim on file" value={claim ? `${str(claim.status)} · ${formatEuro(str(claim.amount))}` : "none"} />
    </dl>
  );
}

function VerificationPanel({ item }: { item: TheaterWorkItemSnapshot }) {
  if (!item.verification) {
    return null;
  }
  const expected = item.verification.expected;
  const observed = item.verification.observed;
  return (
    <div
      role="status"
      aria-live="assertive"
      className={`border px-3 py-3 text-sm ${
        item.verification.matched
          ? "border-[#9dffa1]/40 bg-[#9dffa1]/10 text-[#9dffa1]"
          : "border-[#ffb4a8]/40 text-[#ffb4a8]"
      }`}
    >
      <p className="font-medium">
        {item.verification.matched
          ? "Success — row matches the signed filing."
          : "Mismatch — do not declare success."}
      </p>
      <p className="mt-2 font-mono text-[11px] text-white/70">expected {summarize(expected)}</p>
      <p className="font-mono text-[11px] text-white/70">observed {summarize(observed)}</p>
    </div>
  );
}

function summarize(value: Record<string, unknown>) {
  const amount = value.amount ?? value.farePaid;
  const id = value.locator ?? value.subscriptionId ?? value.orderId ?? value.claimId ?? value.refundId;
  return `${String(id ?? "—")} · ${formatEuro(amount == null ? null : String(amount))}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function str(value: unknown) {
  return value == null ? "—" : String(value);
}

function DeskBlock({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="border-b border-white/10 pb-3">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/45">{label}</p>
      <p className="mt-2 font-board text-3xl text-[#e8b84a]">{value}</p>
      {note ? <p className="mt-2 text-sm text-white/65">{note}</p> : null}
    </div>
  );
}

function Row({ label, value, large }: { label: string; value: string; large?: boolean }) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-white/10 py-2">
      <dt className="text-white/45">{label}</dt>
      <dd className={large ? "font-board text-3xl text-[#e8b84a]" : "font-mono"}>{value}</dd>
    </div>
  );
}
