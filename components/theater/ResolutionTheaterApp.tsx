"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { runTheaterTool } from "@/components/theater/register-theater-tools";
import { MailDisputesPanel } from "@/components/theater/MailDisputesPanel";
import {
  THEATER_STATE_EVENT,
  THEATER_WEBMCP_EVENT,
  type TheaterToolPulse,
} from "@/components/theater/pulse";
import {
  THEATER_WEBMCP_STATUS_EVENT,
  type TheaterWebMcpStatus,
} from "@/components/theater/TheaterWebMcp";
import { ledgerCopy } from "@/src/domain/theater/ledger";
import type { TheaterSnapshot, TheaterWorkItemSnapshot } from "@/src/domain/theater/types";
import { formatEuro } from "@/lib/utils";

type OsApp = "processes" | "inspector" | "console" | "mail" | "about";

function agentPrompt() {
  return "Go ahead.";
}

async function fetchSession(method: "GET" | "POST") {
  const response = await fetch("/api/demo/theater/session", { method });
  const payload = (await response.json()) as {
    theater?: TheaterSnapshot;
    error?: { message?: string; code?: string };
  };
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

const APPS: Array<{ id: OsApp; label: string; short: string }> = [
  { id: "processes", label: "Task Manager", short: "Tasks" },
  { id: "inspector", label: "Inspector", short: "Inspect" },
  { id: "mail", label: "Mail Disputes", short: "Mail" },
  { id: "console", label: "Console", short: "Console" },
  { id: "about", label: "About OS", short: "About" },
];

function deskPulse(name: string) {
  return [
    "inspect_counter",
    "compute_entitlement",
    "execute_filing",
    "verify_filing",
    "begin_resolution",
    "continue_resolution",
  ].includes(name);
}

export function ResolutionTheaterApp({
  webmcp: webmcpProp,
}: {
  webmcp?: TheaterWebMcpStatus;
} = {}) {
  const [theater, setTheater] = useState<TheaterSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [webmcp, setWebmcp] = useState<TheaterWebMcpStatus>(
    webmcpProp ?? { ready: false, reason: "Checking WebMCP…", tools: [] },
  );
  const [tape, setTape] = useState<TheaterToolPulse[]>([]);
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [app, setApp] = useState<OsApp>("processes");
  const [uacOpen, setUacOpen] = useState(false);

  useEffect(() => {
    if (webmcpProp) {
      setWebmcp(webmcpProp);
    }
  }, [webmcpProp]);

  useEffect(() => {
    function onStatus(event: Event) {
      const detail = (event as CustomEvent<TheaterWebMcpStatus>).detail;
      if (detail) {
        setWebmcp(detail);
      }
    }
    window.addEventListener(THEATER_WEBMCP_STATUS_EVENT, onStatus);
    return () => window.removeEventListener(THEATER_WEBMCP_STATUS_EVENT, onStatus);
  }, []);

  const applyTheater = useCallback((next: TheaterSnapshot, focusId?: string) => {
    setTheater(next);
    setSelectedId((current) => focusId ?? current ?? next.items[0]?.id ?? null);
    const waiting = next.items.some((item) => item.status === "AWAITING_SIGNATURE");
    if (waiting) {
      setUacOpen(true);
    }
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
        setTape((current) => [detail, ...current].slice(0, 24));
        const focus =
          detail.input && typeof detail.input.workItemId === "string" ? detail.input.workItemId : undefined;
        if (focus) {
          setSelectedId(focus);
          setApp("inspector");
        }
        if (detail.name === "begin_resolution" && detail.ok) {
          setUacOpen(true);
          setApp("processes");
        }
        if (
          detail.name.startsWith("mail") ||
          detail.name.includes("mail") ||
          detail.name === "begin_mail_resolution" ||
          detail.name === "import_bill" ||
          detail.name === "send_support_email" ||
          detail.name === "verify_sent"
        ) {
          setApp("mail");
        }
        if (detail.name === "continue_resolution" || detail.name === "verify_filing") {
          setApp("inspector");
        }
        if (!detail.ok && detail.code === "APPROVAL_REQUIRED") {
          setUacOpen(true);
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
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setActionError("Clipboard blocked — type Go ahead. in ChatGPT.");
    }
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
      const stillWaiting = payload.theater.items.some((item) => item.status === "AWAITING_SIGNATURE");
      if (!stillWaiting) {
        setUacOpen(false);
        setApp("inspector");
      }
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

  async function beginResolution() {
    setPending("begin");
    setActionError(null);
    try {
      await runTheaterTool("begin_resolution", {});
      setUacOpen(true);
      setApp("processes");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Begin resolution failed.");
    } finally {
      setPending(null);
    }
  }

  async function continueResolution() {
    setPending("continue");
    setActionError(null);
    try {
      await runTheaterTool("continue_resolution", {});
      setApp("inspector");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Continue resolution failed.");
    } finally {
      setPending(null);
    }
  }

  if (loadError) {
    return (
      <main className="os-desktop flex min-h-screen items-center justify-center px-6 text-[#f4efe4]">
        <div className="os-window max-w-lg border border-[#e8b84a]/40 bg-[#0b1f3a] p-8">
          <p className="font-board text-sm tracking-[0.28em] text-[#e8b84a]">SESSION FAILED</p>
          <p className="mt-4 text-lg" role="alert">
            {loadError}
          </p>
          <p className="mt-3 text-sm text-white/60">
            Needs theater tables, FlyRight FR1842, Streamly SL-1001, and blocked FR0999 claim.
          </p>
          <p className="mt-2 font-mono text-[11px] text-white/40">{webmcp.reason}</p>
          <button
            type="button"
            className="theater-btn mt-6 border border-[#e8b84a] px-4 py-2 text-sm text-[#e8b84a]"
            onClick={() => void openSession(true)}
          >
            Retry boot
          </button>
        </div>
      </main>
    );
  }

  if (!theater) {
    return (
      <main className="os-desktop flex min-h-screen items-center justify-center text-[#e8b84a]" aria-busy="true">
        <div className="text-center">
          <p className="font-board tracking-[0.32em]">MOUNTING SESSION…</p>
          <p className="mt-3 font-mono text-[11px] text-white/45">{webmcp.reason}</p>
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
      <main className="os-desktop flex min-h-screen items-center justify-center text-[#e8b84a]">
        <p className="font-board tracking-[0.32em]">NO PROCESSES</p>
      </main>
    );
  }

  const signed = selected.status === "APPROVED";
  const ineligible = selected.entitlement?.outcome === "ineligible" || selected.catalogBlocked;
  const paperPulse = Boolean(lastTool && !deskPulse(lastTool.name));
  const counterPulse = Boolean(lastTool && deskPulse(lastTool.name));
  const sessionLabel = theater.sessionId ? theater.sessionId.slice(0, 8) : "--------";

  return (
    <main className="os-desktop flex min-h-screen flex-col text-[#f4efe4]" aria-busy={Boolean(pending)}>
      <header className="border-b border-[#e8b84a]/25 bg-[#050d18]/95 px-3 py-2 sm:px-5" data-agent-target="menubar">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <p className="font-board text-sm tracking-[0.28em] text-[#e8b84a]">AEGIS OS</p>
            <span className="hidden font-mono text-[11px] text-white/40 sm:inline">session {sessionLabel}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
            <span className={webmcp.ready ? "text-[#9dffa1]" : "text-[#ffb4a8]"} role="status" aria-live="polite">
              {webmcp.ready ? "WEBMCP ONLINE" : "WEBMCP OFF"}
            </span>
            {!webmcp.ready ? (
              <button
                type="button"
                className="theater-btn text-[#e8b84a] underline-offset-2 hover:underline"
                onClick={() => window.dispatchEvent(new Event("focus"))}
              >
                Rebind
              </button>
            ) : null}
            <span className="text-white/30">|</span>
            <span className="text-white/55">{awaiting.length} UAC</span>
            <span className="text-white/30">|</span>
            <span className="text-white/55">{formatEuro(recoverable)} stake</span>
            <button
              type="button"
              className="theater-btn text-white/45 hover:text-[#e8b84a]"
              disabled={Boolean(pending)}
              onClick={() => void openSession(true)}
            >
              {pending === "reset" ? "…" : "New session"}
            </button>
          </div>
        </div>
      </header>

      <section className="border-b border-[#0b1f3a] bg-[#e8b84a] px-3 py-2.5 text-[#0b1f3a] sm:px-5">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-snug">
            <span className="font-board text-[11px] tracking-[0.2em]">COMMAND</span>
            <span className="ml-2">
              Say <span className="font-mono font-semibold">“{prompt}”</span> for provider filings, or{" "}
              <span className="font-mono font-semibold">“Check my email for CodeForge and prepare a refund.”</span>
            </span>
          </p>
          <button
            type="button"
            onClick={() => void copyPrompt()}
            className="theater-btn shrink-0 bg-[#0b1f3a] px-3 py-2 text-sm text-[#e8b84a]"
            aria-label="Copy demo goal to clipboard"
            aria-pressed={copied}
          >
            {copied ? "Copied" : "Copy “Go ahead.”"}
          </button>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-3 px-3 py-3 pb-28 sm:px-5 lg:grid lg:grid-cols-[0.95fr_1.05fr] lg:pb-24">
        <WindowFrame
          title="Task Manager · Disputes"
          active={app === "processes"}
          pulse={paperPulse}
          tone="paper"
          agentTarget="processes"
          className={`bg-[#ede6d6] text-[#1a1714] ${app === "processes" ? "" : "hidden lg:flex"}`}
          onFocus={() => setApp("processes")}
        >
          <p className="border-b border-dashed border-[#1a1714]/25 px-4 py-3 text-sm text-[#5c5348] sm:px-5">
            Money on this desktop: <strong>{formatEuro(recoverable)}</strong>. One blocked booking must not file.
          </p>
          <ol className="space-y-2 px-4 py-4 sm:px-5">
            {theater.items.map((item) => (
              <WorkItemRow
                key={item.id}
                item={item}
                active={item.id === selected.id}
                onSelect={() => {
                  setSelectedId(item.id);
                  setApp("inspector");
                }}
              />
            ))}
          </ol>
          <div className="mt-auto border-t border-[#1a1714]/15 px-4 py-4 sm:px-5">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="theater-btn bg-[#1a1714] px-3 py-2 text-sm text-[#ede6d6] disabled:opacity-40"
                disabled={Boolean(pending)}
                onClick={() => void beginResolution()}
              >
                {pending === "begin" ? "Starting…" : "Begin resolution"}
              </button>
              <button
                type="button"
                className="theater-btn border border-[#1a1714] px-3 py-2 text-sm disabled:opacity-40"
                disabled={
                  Boolean(pending) ||
                  awaiting.length > 0 ||
                  !theater.items.some((item) => item.status === "APPROVED")
                }
                onClick={() => void continueResolution()}
              >
                {pending === "continue" ? "Continuing…" : "Continue after signatures"}
              </button>
              {awaiting.length > 0 ? (
                <button
                  type="button"
                  className="theater-btn border border-[#8a3b12] px-3 py-2 text-sm text-[#8a3b12]"
                  onClick={() => setUacOpen(true)}
                >
                  Open UAC ({awaiting.length})
                </button>
              ) : null}
            </div>
            {actionError && app === "processes" ? (
              <p className="mt-3 text-sm text-[#9b1c1c]" role="alert">
                {actionError}
              </p>
            ) : null}
          </div>
        </WindowFrame>

        <WindowFrame
          title="Inspector · Provider row"
          active={app === "inspector"}
          pulse={counterPulse}
          agentTarget="inspector"
          className={`border border-[#e8b84a]/20 bg-[#0b1f3a] ${app === "inspector" ? "" : "hidden lg:flex"}`}
          onFocus={() => setApp("inspector")}
        >
          <div className="space-y-4 px-4 py-4 sm:px-5">
            <div>
              <p className="font-board text-3xl uppercase tracking-wide">{selected.title}</p>
              <p className="mt-2 text-sm text-white/70">{selected.problem}</p>
              <p className="mt-1 font-mono text-[11px] text-white/35">{selected.source}</p>
            </div>
            <Pipeline status={selected.status} />
            <CounterRecord item={selected} />
            <DeskBlock
              label="Engine amount"
              value={
                selected.entitlement
                  ? `${selected.entitlement.outcome} · ${formatEuro(selected.entitlement.amount)}`
                  : "—"
              }
              note={selected.entitlement?.reasons[0] ?? "Amounts come from the row, not the model."}
            />

            {selected.catalogBlocked ? (
              <div className="border-2 border-[#ffb4a8] bg-[#ffb4a8]/10 px-4 py-4 text-[#ffb4a8]" role="status">
                <p className="font-board text-xs tracking-[0.22em]">KERNEL BLOCK · FR0999 / BERG</p>
                <p className="mt-2 text-lg font-medium">Already claimed. Do not file.</p>
              </div>
            ) : ineligible ? (
              <p className="border border-[#ffb4a8]/40 px-3 py-2 text-sm text-[#ffb4a8]" role="status">
                Process blocked. Do not sign this one.
              </p>
            ) : null}

            {lastTool && !lastTool.ok && lastTool.code === "APPROVAL_REQUIRED" ? (
              <div className="border-2 border-[#e8b84a] bg-[#e8b84a]/15 px-4 py-4 text-[#e8b84a]" role="alert">
                <p className="font-board text-xs tracking-[0.22em]">UAC DENIED · APPROVAL_REQUIRED</p>
                <p className="mt-2 text-lg font-medium">Unsigned filing refused.</p>
              </div>
            ) : null}

            {selected.status === "APPROVED" && !selected.verification ? (
              <p className="border border-[#e8b84a]/40 px-3 py-2 text-sm text-[#e8b84a]" role="status">
                UAC granted. Call continue_resolution (or execute → verify).
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
                {pending === "inspect_counter" ? "Looking up…" : "Inspect row"}
              </button>
              <button
                type="button"
                className="theater-btn border border-[#ffb4a8]/50 px-3 py-2 text-sm text-[#ffb4a8] disabled:opacity-40"
                disabled={Boolean(pending) || selected.status === "VERIFIED"}
                onClick={() => void run("execute_filing", selected.id)}
              >
                {pending === "execute_filing" ? "Filing…" : "File without signature"}
              </button>
              <button
                type="button"
                className="theater-btn border border-white/30 px-3 py-2 text-sm disabled:opacity-40"
                disabled={Boolean(pending) || !signed}
                onClick={() => void fileSigned(selected.id)}
              >
                {pending === "file" ? "Filing…" : "File signed claim"}
              </button>
            </div>
            {actionError && app === "inspector" ? (
              <p className="text-sm text-[#ffb4a8]" role="alert">
                {actionError}
              </p>
            ) : null}
            <p className="font-mono text-[11px] text-white/40">{webmcp.reason}</p>
          </div>
        </WindowFrame>

        <WindowFrame
          title="Mail Disputes · Sandbox mailbox"
          active={app === "mail"}
          agentTarget="mail"
          className={`border border-[#e8b84a]/20 bg-[#0b1f3a] lg:col-span-2 ${
            app === "mail" ? "flex min-h-[28rem]" : "hidden"
          }`}
          onFocus={() => setApp("mail")}
        >
          <MailDisputesPanel active={app === "mail"} />
        </WindowFrame>

        <WindowFrame
          title="System Console · Agent ledger"
          active={app === "console"}
          agentTarget="console"
          className={`border border-[#e8b84a]/20 bg-[#050d18] lg:col-span-2 ${
            app === "console" ? "" : "hidden lg:flex"
          }`}
          onFocus={() => setApp("console")}
        >
          <div className="max-h-56 overflow-auto px-4 py-4 sm:px-5" aria-live="polite">
            {tape.length === 0 ? (
              <p className="font-mono text-sm text-white/35">
                Waiting for tool calls. Preferred: begin_resolution · continue_resolution.
              </p>
            ) : (
              <ol className="space-y-2">
                {tape.map((entry, index) => {
                  const copy = ledgerCopy({ name: entry.name, ok: entry.ok, code: entry.code });
                  return (
                    <li
                      key={`${entry.at}-${entry.name}-${index}`}
                      className={`border-l-2 pl-3 ${
                        entry.ok ? "border-[#9dffa1] text-[#9dffa1]" : "border-[#ffb4a8] text-[#ffb4a8]"
                      }`}
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
          </div>
        </WindowFrame>

        <WindowFrame
          title="About · Kernel policy"
          active={app === "about"}
          className={`border border-[#e8b84a]/20 bg-[#0b1f3a] lg:col-span-2 ${
            app === "about" ? "flex" : "hidden"
          }`}
          onFocus={() => setApp("about")}
        >
          <div className="space-y-4 px-4 py-5 sm:px-6">
            <h2 className="font-board text-3xl uppercase tracking-wide text-[#e8b84a]">
              You sign. It files. The row must match.
            </h2>
            <p className="max-w-3xl text-sm leading-relaxed text-white/70">
              Aegis OS is not a chatbot. ChatGPT operates this desktop through WebMCP. You authorize money. Software
              owns entitlement math. Success is a provider re-read — expected vs observed.
            </p>
            <ul className="grid gap-3 sm:grid-cols-2">
              <AboutFact title="You" body="Only a person signs. The model never grants itself permission." />
              <AboutFact title="ChatGPT" body="Calls begin_resolution, then continue_resolution after UAC." />
              <AboutFact title="Software" body="Amounts come from deterministic policy against live rows." />
              <AboutFact title="Provider" body="verify_filing must match. Otherwise do not declare success." />
            </ul>
            <p className="font-mono text-[11px] text-white/40">
              FR0999 / BERG stays blocked. Eligible rows: fresh FlyRight ticket + Streamly subscription.
            </p>
          </div>
        </WindowFrame>
      </div>

      <nav
        className="os-dock fixed bottom-0 left-0 right-0 z-40 border-t border-[#e8b84a]/25 px-3 py-2 sm:px-5"
        aria-label="Aegis OS dock"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">
          <div className="flex flex-1 gap-1 overflow-x-auto">
            {APPS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={`theater-btn shrink-0 px-3 py-2 text-xs sm:text-sm ${
                  app === entry.id ? "bg-[#e8b84a] text-[#0b1f3a]" : "text-white/70 hover:bg-white/5"
                }`}
                aria-current={app === entry.id ? "page" : undefined}
                onClick={() => setApp(entry.id)}
              >
                <span className="sm:hidden">{entry.short}</span>
                <span className="hidden sm:inline">{entry.label}</span>
              </button>
            ))}
          </div>
          {awaiting.length > 0 ? (
            <button
              type="button"
              className="theater-btn shrink-0 bg-[#e8b84a] px-3 py-2 text-xs font-medium text-[#0b1f3a] sm:text-sm"
              onClick={() => setUacOpen(true)}
            >
              UAC · {awaiting.length}
            </button>
          ) : null}
        </div>
      </nav>

      {uacOpen && awaiting.length > 0 ? (
        <div className="os-uac-scrim fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="uac-title"
            data-agent-target="uac"
            className="os-window max-h-[85vh] w-full max-w-lg overflow-auto border border-[#e8b84a]/50 bg-[#ede6d6] text-[#1a1714]"
          >
            <div className="os-titlebar flex items-center justify-between border-b border-[#1a1714]/15 bg-[#d9d0bc] px-4 py-3">
              <p id="uac-title" className="font-board text-xs tracking-[0.24em] text-[#8a3b12]">
                USER ACCOUNT CONTROL
              </p>
              <button type="button" className="theater-btn text-sm text-[#5c5348]" onClick={() => setUacOpen(false)}>
                Minimize
              </button>
            </div>
            <div className="space-y-4 px-4 py-5">
              <p className="text-sm text-[#5c5348]">
                Aegis wants to file money-changing actions. Sign each amount. Deny stops that process.
              </p>
              {awaiting.map((item) => (
                <div key={item.id} className="border border-[#1a1714]/20 bg-white/70 p-4">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-1 font-board text-5xl leading-none">{formatEuro(item.proposal?.amount)}</p>
                  <p className="mt-2 font-mono text-xs text-[#5c5348]">
                    {item.proposal?.toolName ?? "filing"} · {identityLine(item)}
                  </p>
                  <p className="mt-2 text-sm text-[#5c5348]">{item.entitlement?.reasons[0]}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="theater-btn bg-[#1a1714] px-3 py-2 text-sm text-[#ede6d6] disabled:opacity-40"
                      disabled={Boolean(pending)}
                      onClick={() => void decide(item.id, "approved")}
                    >
                      {pending === `decide:approved:${item.id}`
                        ? "Signing…"
                        : `Sign ${formatEuro(item.proposal?.amount)}`}
                    </button>
                    <button
                      type="button"
                      className="theater-btn border border-[#1a1714] px-3 py-2 text-sm disabled:opacity-40"
                      disabled={Boolean(pending)}
                      onClick={() => void decide(item.id, "denied")}
                    >
                      {pending === `decide:denied:${item.id}` ? "Denying…" : "Deny"}
                    </button>
                  </div>
                </div>
              ))}
              {actionError ? (
                <p className="text-sm text-[#9b1c1c]" role="alert">
                  {actionError}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function WindowFrame({
  title,
  children,
  className,
  active,
  pulse,
  tone = "ink",
  agentTarget,
  onFocus,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  active?: boolean;
  pulse?: boolean;
  tone?: "ink" | "paper";
  agentTarget?: string;
  onFocus?: () => void;
}) {
  return (
    <section
      data-agent-target={agentTarget}
      className={`os-window flex min-h-0 flex-col overflow-hidden ${active ? "ring-1 ring-[#e8b84a]/50" : ""} ${
        pulse ? "chamber-pulse-desk" : ""
      } ${className ?? ""}`}
      onMouseDown={onFocus}
    >
      <div
        className={`os-titlebar flex items-center justify-between border-b px-4 py-2 ${
          tone === "paper" ? "border-[#1a1714]/15 bg-[#d9d0bc]" : "border-white/10"
        }`}
      >
        <p
          className={`font-board text-[11px] tracking-[0.22em] ${
            tone === "paper" ? "text-[#8a3b12]" : "text-[#e8b84a]"
          }`}
        >
          {title}
        </p>
        <span className="flex gap-1" aria-hidden>
          <span className={`h-2.5 w-2.5 rounded-full ${tone === "paper" ? "bg-[#1a1714]/20" : "bg-white/20"}`} />
          <span className={`h-2.5 w-2.5 rounded-full ${tone === "paper" ? "bg-[#1a1714]/20" : "bg-white/20"}`} />
          <span className="h-2.5 w-2.5 rounded-full bg-[#e8b84a]/70" />
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

function AboutFact({ title, body }: { title: string; body: string }) {
  return (
    <li className="border border-white/10 px-3 py-3">
      <p className="font-board text-xl uppercase tracking-wide text-[#e8b84a]">{title}</p>
      <p className="mt-1 text-sm text-white/65">{body}</p>
    </li>
  );
}

function identityLine(item: TheaterWorkItemSnapshot) {
  const identity = item.identity;
  if (!identity) return "—";
  if (identity.providerId === "flyright") {
    return `${identity.locator} / ${identity.lastName}`;
  }
  if (identity.providerId === "streamly") {
    return `${identity.subscriptionId} / ${identity.accountEmail}`;
  }
  return `${identity.orderId} / ${identity.lastName}`;
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
  const status = String(item.status ?? "UNKNOWN");
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
          {item.providerId} · {status.replaceAll("_", " ").toLowerCase()}
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
              here
                ? "bg-[#e8b84a] text-[#0b1f3a]"
                : reached
                  ? "border border-white/30 text-white"
                  : "border border-white/10 text-white/35"
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
        No record yet. Begin resolution or Inspect row — the passenger or plan appears here.
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
  const matched = item.verification.matched;
  return (
    <div
      role="status"
      aria-live="assertive"
      className={`border-2 px-4 py-4 ${
        matched ? "border-[#9dffa1] bg-[#9dffa1]/15 text-[#9dffa1]" : "border-[#ffb4a8] bg-[#ffb4a8]/10 text-[#ffb4a8]"
      }`}
    >
      <p className="font-board text-xs tracking-[0.22em]">{matched ? "VERIFY · MATCHED" : "VERIFY · MISMATCH"}</p>
      <p className="mt-2 font-board text-3xl uppercase leading-none tracking-wide">
        {matched ? "Row matches. Done." : "Do not declare success."}
      </p>
      <p className="mt-3 font-mono text-[11px] text-white/70">expected {summarize(item.verification.expected)}</p>
      <p className="font-mono text-[11px] text-white/70">observed {summarize(item.verification.observed)}</p>
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
