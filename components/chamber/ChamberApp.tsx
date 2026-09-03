"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChamberWebMcp } from "@/components/chamber/ChamberWebMcp";
import {
  CHAMBER_STATE_EVENT,
  CHAMBER_WEBMCP_EVENT,
  pulseChamberTool,
  type ChamberToolPulse,
} from "@/components/chamber/pulse";
import { formatEuro } from "@/lib/utils";
import type { ChamberSnapshot } from "@/src/domain/chamber/types";

function agentScript(chamber: ChamberSnapshot) {
  return `Look up FlyRight booking ${chamber.locator}, last name ${chamber.lastName}. Calculate the unused-fare refund. Then file the claim with submit_claim.`;
}

export function ChamberApp() {
  const [chamber, setChamber] = useState<ChamberSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [webmcp, setWebmcp] = useState({ ready: false, reason: "Checking WebMCP…" });
  const [tape, setTape] = useState<ChamberToolPulse[]>([]);
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const applyChamber = useCallback((next: ChamberSnapshot) => {
    setChamber(next);
  }, []);

  async function openSession(reset = false) {
    setPending(reset ? "reset" : "open");
    setLoadError(null);
    setActionError(null);
    try {
      const response = await fetch("/api/demo/session", {
        method: reset ? "POST" : "GET",
      });
      if (response.status === 404 && !reset) {
        const created = await fetch("/api/demo/session", { method: "POST" });
        const payload = (await created.json()) as {
          chamber?: ChamberSnapshot;
          error?: { message?: string };
        };
        if (!created.ok || !payload.chamber) {
          throw new Error(payload.error?.message ?? "Could not open a chamber.");
        }
        setChamber(payload.chamber);
        return;
      }
      const payload = (await response.json()) as {
        chamber?: ChamberSnapshot;
        error?: { message?: string };
      };
      if (!response.ok || !payload.chamber) {
        throw new Error(payload.error?.message ?? "Could not open a chamber.");
      }
      setChamber(payload.chamber);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not open a chamber.");
    } finally {
      setPending(null);
    }
  }

  useEffect(() => {
    void openSession(false);
  }, []);

  useEffect(() => {
    function onState(event: Event) {
      const detail = (event as CustomEvent<ChamberSnapshot>).detail;
      if (detail) {
        applyChamber(detail);
      }
    }
    function onPulse(event: Event) {
      const detail = (event as CustomEvent<ChamberToolPulse>).detail;
      if (detail) {
        setTape((current) => [detail, ...current].slice(0, 12));
      }
    }
    window.addEventListener(CHAMBER_STATE_EVENT, onState);
    window.addEventListener(CHAMBER_WEBMCP_EVENT, onPulse);
    return () => {
      window.removeEventListener(CHAMBER_STATE_EVENT, onState);
      window.removeEventListener(CHAMBER_WEBMCP_EVENT, onPulse);
    };
  }, [applyChamber]);

  const lastTool = tape[0]?.name ?? null;
  const script = useMemo(() => (chamber ? agentScript(chamber) : ""), [chamber]);

  async function copyScript() {
    await navigator.clipboard.writeText(script);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function decide(decision: "approved" | "denied") {
    setPending(decision);
    setActionError(null);
    try {
      const response = await fetch("/api/demo/session/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const payload = (await response.json()) as {
        chamber?: ChamberSnapshot;
        error?: { message?: string };
      };
      if (!response.ok || !payload.chamber) {
        throw new Error(payload.error?.message ?? "Signature failed.");
      }
      setChamber(payload.chamber);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Signature failed.");
    } finally {
      setPending(null);
    }
  }

  async function humanLookup() {
    if (!chamber) {
      return;
    }
    setPending("lookup");
    setActionError(null);
    try {
      const response = await fetch("/api/demo/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: "get_booking",
          input: { locator: chamber.locator, lastName: chamber.lastName },
        }),
      });
      const payload = (await response.json()) as {
        chamber?: ChamberSnapshot;
        error?: { message?: string };
      };
      if (!response.ok) {
        pulseChamberTool({
          name: "get_booking",
          ok: false,
          message: payload.error?.message ?? "Lookup failed.",
          at: new Date().toISOString(),
        });
        throw new Error(payload.error?.message ?? "Lookup failed.");
      }
      pulseChamberTool({
        name: "get_booking",
        ok: true,
        message: "get_booking wrote into this page",
        at: new Date().toISOString(),
      });
      if (payload.chamber) {
        setChamber(payload.chamber);
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Lookup failed.");
    } finally {
      setPending(null);
    }
  }

  async function humanFile() {
    if (!chamber) {
      return;
    }
    setPending("file");
    setActionError(null);
    try {
      const response = await fetch("/api/demo/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: "submit_claim",
          input: {
            locator: chamber.locator,
            lastName: chamber.lastName,
            amount: chamber.approvedAmount ?? chamber.compensation?.amount,
          },
        }),
      });
      const payload = (await response.json()) as {
        chamber?: ChamberSnapshot;
        error?: { message?: string };
      };
      if (payload.chamber) {
        setChamber(payload.chamber);
      }
      if (!response.ok) {
        pulseChamberTool({
          name: "submit_claim",
          ok: false,
          message: payload.error?.message ?? "Filing failed.",
          at: new Date().toISOString(),
        });
        throw new Error(payload.error?.message ?? "Filing failed.");
      }
      pulseChamberTool({
        name: "submit_claim",
        ok: true,
        message: "submit_claim wrote into this page",
        at: new Date().toISOString(),
      });
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
          <p className="font-[family-name:var(--font-board)] text-sm tracking-[0.28em] text-[#e8b84a]">
            CHAMBER CLOSED
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

  if (!chamber) {
    return (
      <main className="chamber-root flex min-h-screen items-center justify-center text-[#e8b84a]">
        <p className="font-[family-name:var(--font-board)] tracking-[0.32em]">ISSUING TICKET…</p>
      </main>
    );
  }

  const deskHasStub = chamber.booking?.locator === chamber.locator;
  const eligible = deskHasStub && chamber.compensation?.outcome === "eligible";
  const amount =
    chamber.claim?.amount ??
    chamber.approvedAmount ??
    (deskHasStub ? chamber.compensation?.amount ?? null : null);
  const signed = chamber.approval === "approved";
  const deskLive = Boolean(chamber.booking);
  const verified = chamber.verification?.matched === true;

  return (
    <main className="chamber-root min-h-screen text-[#f4efe4]">
      <ChamberWebMcp locator={chamber.locator} lastName={chamber.lastName} onStatus={(ready, reason) => setWebmcp({ ready, reason })} />

      <header className="border-b border-[#e8b84a]/25 bg-[#071525] px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-[family-name:var(--font-board)] text-xs tracking-[0.34em] text-[#e8b84a]">
              AEGIS CHAMBER · FLYRIGHT
            </p>
            <h1 className="mt-1 font-[family-name:var(--font-board)] text-4xl uppercase leading-none tracking-wide sm:text-5xl">
              One page. One signature. One desk.
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
            Open this URL in <strong>ChatGPT’s in-app browser</strong>. Say:
            <span className="mt-1 block font-mono text-[13px] font-medium">“{script}”</span>
          </p>
          <button
            type="button"
            onClick={() => void copyScript()}
            className="shrink-0 bg-[#0b1f3a] px-4 py-2 text-sm text-[#e8b84a]"
          >
            {copied ? "Copied" : "Copy prompt"}
          </button>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-0 lg:grid-cols-[1fr_1.05fr]">
        <section
          className={`bg-[#ede6d6] text-[#1a1714] ${lastTool === "get_chamber" ? "chamber-pulse" : ""}`}
        >
          <div className="border-b border-dashed border-[#1a1714]/30 px-6 py-5 sm:px-8">
            <p className="font-[family-name:var(--font-board)] text-xs tracking-[0.3em] text-[#8a3b12]">
              HUMAN STUB
            </p>
            <p className="mt-2 font-[family-name:var(--font-board)] text-5xl leading-none tracking-wide">
              {chamber.locator}
            </p>
            <p className="mt-2 font-mono text-sm">
              {chamber.passengerFirstName} {chamber.lastName} · {chamber.origin}→{chamber.destination}
            </p>
          </div>

          <div className="space-y-5 px-6 py-6 sm:px-8">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#8a3b12]">Engine amount</p>
              <p className="font-[family-name:var(--font-board)] text-6xl leading-none">
                {amount ? formatEuro(amount) : "—"}
              </p>
              <p className="mt-2 text-sm text-[#5c5348]">
                {deskHasStub
                  ? chamber.compensation?.reasons[0]
                  : "Ask the agent to look up this ticket. The amount is calculated from the booking fare, not invented."}
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-[#8a3b12]">Signature</dt>
                <dd className="font-medium uppercase">{chamber.approval}</dd>
              </div>
              <div>
                <dt className="text-[#8a3b12]">On file</dt>
                <dd className="font-medium">{chamber.claim?.status ?? "none"}</dd>
              </div>
            </dl>

            {actionError ? <p className="text-sm text-[#9b1c1c]">{actionError}</p> : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={Boolean(pending) || !eligible || signed || chamber.approval === "denied"}
                onClick={() => void decide("approved")}
                className="bg-[#1a1714] px-4 py-2 text-sm text-[#ede6d6] disabled:opacity-40"
              >
                {pending === "approved" ? "Signing…" : "Sign the filing"}
              </button>
              <button
                type="button"
                disabled={Boolean(pending) || chamber.approval === "denied" || Boolean(chamber.claim)}
                onClick={() => void decide("denied")}
                className="border border-[#1a1714] px-4 py-2 text-sm disabled:opacity-40"
              >
                Deny
              </button>
              <button
                type="button"
                disabled={Boolean(pending)}
                onClick={() => void humanLookup()}
                className="border border-[#1a1714]/40 px-4 py-2 text-sm disabled:opacity-40"
              >
                Look up without agent
              </button>
              <button
                type="button"
                disabled={Boolean(pending) || !signed || Boolean(chamber.claim)}
                onClick={() => void humanFile()}
                className="border border-[#8a3b12] px-4 py-2 text-sm text-[#8a3b12] disabled:opacity-40"
              >
                {pending === "file" ? "Filing…" : "File after signature"}
              </button>
            </div>

            <p className="text-xs leading-relaxed text-[#5c5348]">
              The agent’s <span className="font-mono">submit_claim</span> fails until you sign. Signing
              does not file. Filing mutates FlyRight, then this page re-reads the claim.
            </p>
          </div>
        </section>

        <section
          className={`border-t border-[#e8b84a]/20 bg-[#0b1f3a] lg:border-l lg:border-t-0 ${
            lastTool && lastTool !== "get_chamber" ? "chamber-pulse-desk" : ""
          }`}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-5 sm:px-8">
            <div>
              <p className="font-[family-name:var(--font-board)] text-xs tracking-[0.3em] text-[#e8b84a]">
                FLYRIGHT DESK
              </p>
              <p className="font-[family-name:var(--font-board)] text-3xl uppercase tracking-wide">
                Carrier counter
              </p>
            </div>
            <p className="font-mono text-[11px] text-white/50">SANDBOX</p>
          </div>

          <div className="px-6 py-6 sm:px-8">
            {!deskLive ? (
              <p className="max-w-sm text-sm text-white/60">
                No record on the desk. When the agent calls get_booking, the passenger appears here —
                same session, no refresh required.
              </p>
            ) : (
              <>
                {chamber.booking && chamber.booking.locator !== chamber.locator ? (
                  <p className="mb-4 border border-[#e8b84a]/30 px-3 py-2 text-sm text-[#e8b84a]">
                    Viewing {chamber.booking.locator} — not the stub on the left.
                  </p>
                ) : null}
                <dl className="space-y-3 text-sm">
                <Row label="Passenger" value={`${chamber.booking?.passengerFirstName} ${chamber.booking?.lastName}`} />
                <Row
                  label="Flight"
                  value={`${chamber.booking?.flightNumber} ${chamber.booking?.origin}→${chamber.booking?.destination}`}
                />
                <Row label="Status" value={chamber.booking?.flightStatus ?? "—"} />
                <Row label="Fare" value={formatEuro(chamber.booking?.farePaid)} large />
                <Row
                  label="Claim"
                  value={
                    chamber.claim
                      ? `${chamber.claim.status} · ${formatEuro(chamber.claim.amount)}`
                      : "none"
                  }
                  />
              </dl>
              </>
            )}

            {verified ? (
              <p className="mt-6 border border-[#9dffa1]/40 bg-[#9dffa1]/10 px-3 py-2 text-sm text-[#9dffa1]">
                Verified. Observed claim matches the signed amount.
              </p>
            ) : chamber.verification && !chamber.verification.matched ? (
              <p className="mt-6 border border-[#ffb4a8]/40 px-3 py-2 text-sm text-[#ffb4a8]">
                Verification mismatch. This is not marked successful.
              </p>
            ) : signed && !chamber.claim ? (
              <p className="mt-6 text-sm text-[#e8b84a]">
                Signed. The agent may now call submit_claim.
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
            <button
              type="button"
              className="text-xs uppercase tracking-[0.16em] text-white/40"
              disabled={Boolean(pending)}
              onClick={() => void openSession(true)}
            >
              {pending === "reset" ? "Issuing…" : "Fresh ticket"}
            </button>
          </div>
          {tape.length === 0 ? (
            <p className="mt-3 font-mono text-sm text-white/35">
              Waiting for a tool call. get_booking · calculate_compensation · submit_claim
            </p>
          ) : (
            <ol className="mt-3 space-y-1 font-mono text-sm">
              {tape.map((entry) => (
                <li key={`${entry.at}-${entry.name}`} className={entry.ok ? "text-[#9dffa1]" : "text-[#ffb4a8]"}>
                  {entry.name} — {entry.message}
                </li>
              ))}
            </ol>
          )}
          <p className="mt-4 text-xs text-white/35">
            Probe failures: {chamber.catalog.ineligible.locator}/{chamber.catalog.ineligible.lastName} stays
            scheduled. {chamber.catalog.alreadyClaimed.locator}/{chamber.catalog.alreadyClaimed.lastName} is
            already claimed.{" "}
            <Link href="/inbox" className="underline decoration-white/30 underline-offset-2">
              Full bureau (login)
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

function Row({
  label,
  value,
  large,
}: {
  label: string;
  value: string;
  large?: boolean;
}) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-white/10 py-2">
      <dt className="text-white/45">{label}</dt>
      <dd className={large ? "font-[family-name:var(--font-board)] text-3xl text-[#e8b84a]" : "font-mono"}>
        {value}
      </dd>
    </div>
  );
}
