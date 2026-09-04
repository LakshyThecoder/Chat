"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AgentPromptArsenal } from "@/components/flight-desk/AgentPromptArsenal";
import { AgentTape } from "@/components/flight-desk/AgentTape";
import { EvidenceResearch } from "@/components/flight-desk/EvidenceResearch";
import { FlightDeskWebMcp } from "@/components/flight-desk/FlightDeskWebMcp";
import {
  FLIGHT_DESK_FOCUS_EVENT,
  type FlightDeskFocusDetail,
} from "@/components/flight-desk/register-flight-desk-tools";
import { FlyRightDrawer } from "@/components/flight-desk/FlyRightDrawer";
import { InboxRail } from "@/components/flight-desk/InboxRail";
import { ItineraryRibbon } from "@/components/flight-desk/ItineraryRibbon";
import { JudgeMission } from "@/components/flight-desk/JudgeMission";
import { PermissionSheet } from "@/components/flight-desk/PermissionSheet";
import { ProductShell } from "@/components/flight-desk/ProductShell";
import { RightsCard } from "@/components/flight-desk/RightsCard";
import { TravelGraph } from "@/components/flight-desk/TravelGraph";
import { runTheaterTool } from "@/components/theater/register-theater-tools";
import { THEATER_STATE_EVENT, THEATER_WEBMCP_EVENT, type TheaterToolPulse } from "@/components/theater/pulse";
import { THEATER_WEBMCP_STATUS_EVENT, type TheaterWebMcpStatus } from "@/components/theater/TheaterWebMcp";
import { AIRLINE_INBOX, type AirlineMailThread } from "@/src/domain/flight-desk/inbox-catalog";
import {
  evaluatePassengerRights,
  inferPassengerRightsInputs,
} from "@/src/domain/eligibility/evaluate-passenger-rights";
import {
  bookingFromCounter,
  isFlyRightItem,
  rightsFromWorkItem,
} from "@/src/domain/flight-desk/rights-from-item";
import type { TheaterSnapshot, TheaterWorkItemSnapshot } from "@/src/domain/theater/types";
import "@/app/flight-desk.css";

async function fetchSession(method: "GET" | "POST") {
  const response = await fetch("/api/demo/theater/session", { method });
  const payload = (await response.json()) as {
    theater?: TheaterSnapshot;
    error?: { message?: string };
  };
  if (!response.ok || !payload.theater) {
    throw new Error(payload.error?.message ?? "Could not open the flight desk.");
  }
  return payload.theater;
}

function flightsOf(theater: TheaterSnapshot | null): TheaterWorkItemSnapshot[] {
  return theater?.items.filter(isFlyRightItem) ?? [];
}

function nextActionCopy(theater: TheaterSnapshot | null, webmcpReady: boolean): string {
  if (!webmcpReady) return "Open this URL in ChatGPT’s in-app browser so tools can bind.";
  if (!theater) return "Connect the airline inbox.";
  const flights = flightsOf(theater);
  if (flights.some((item) => item.status === "AWAITING_SIGNATURE")) {
    return "Sign the prepared amount. The agent cannot file until you do.";
  }
  if (flights.some((item) => item.status === "APPROVED")) {
    return "Say “Continue.” The desk will file and re-read FlyRight.";
  }
  if (flights.some((item) => item.status === "VERIFIED" && item.verification?.matched)) {
    return "Verified. The carrier row matches the signed amount.";
  }
  return "Say “Check my airline email and tell me what I’m owed.”";
}

export function FlightDeskApp() {
  const [webmcp, setWebmcp] = useState<TheaterWebMcpStatus>({
    ready: false,
    reason: "Binding WebMCP…",
    tools: [],
  });
  const [theater, setTheater] = useState<TheaterSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mailId, setMailId] = useState<string>(AIRLINE_INBOX[0]?.id ?? "");
  const [tape, setTape] = useState<TheaterToolPulse[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [researchLive, setResearchLive] = useState(false);

  const applyTheater = useCallback((next: TheaterSnapshot, focusId?: string) => {
    setTheater(next);
    const flights = flightsOf(next);
    setSelectedId((current) => {
      if (focusId && flights.some((item) => item.id === focusId)) return focusId;
      if (current && flights.some((item) => item.id === current)) return current;
      return flights.find((item) => !item.catalogBlocked)?.id ?? flights[0]?.id ?? null;
    });
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
          throw new Error(payload.error?.message ?? "Could not open the flight desk.");
        }
        applyTheater(payload.theater);
        return;
      }
      applyTheater(await fetchSession("POST"));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not open the flight desk.");
    } finally {
      setPending(null);
    }
  }

  useEffect(() => {
    void openSession(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/health/integrations")
      .then(async (response) => {
        if (!response.ok) return;
        const payload = (await response.json()) as { integrations?: { officialResearch?: boolean } };
        if (!cancelled) setResearchLive(Boolean(payload.integrations?.officialResearch));
      })
      .catch(() => {
        if (!cancelled) setResearchLive(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onStatus(event: Event) {
      const detail = (event as CustomEvent<TheaterWebMcpStatus>).detail;
      if (detail) setWebmcp(detail);
    }
    window.addEventListener(THEATER_WEBMCP_STATUS_EVENT, onStatus);
    return () => window.removeEventListener(THEATER_WEBMCP_STATUS_EVENT, onStatus);
  }, []);

  useEffect(() => {
    function onState(event: Event) {
      const detail = (event as CustomEvent<TheaterSnapshot>).detail;
      if (detail) applyTheater(detail);
    }
    function onPulse(event: Event) {
      const detail = (event as CustomEvent<TheaterToolPulse>).detail;
      if (!detail) return;
      setTape((current) => [detail, ...current].slice(0, 20));
      const focus = detail.input && typeof detail.input.workItemId === "string" ? detail.input.workItemId : undefined;
      if (focus) setSelectedId(focus);
    }
    window.addEventListener(THEATER_STATE_EVENT, onState);
    window.addEventListener(THEATER_WEBMCP_EVENT, onPulse);
    return () => {
      window.removeEventListener(THEATER_STATE_EVENT, onState);
      window.removeEventListener(THEATER_WEBMCP_EVENT, onPulse);
    };
  }, [applyTheater]);

  useEffect(() => {
    function onAgentFocus(event: Event) {
      const detail = (event as CustomEvent<FlightDeskFocusDetail>).detail;
      if (detail.workItemId) setSelectedId(detail.workItemId);
      if (detail.mailId) setMailId(detail.mailId);
      document.getElementById(`agent-${detail.target}`)?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "center",
      });
    }
    window.addEventListener(FLIGHT_DESK_FOCUS_EVENT, onAgentFocus);
    return () => window.removeEventListener(FLIGHT_DESK_FOCUS_EVENT, onAgentFocus);
  }, []);

  const flights = useMemo(() => flightsOf(theater), [theater]);
  const selected = flights.find((item) => item.id === selectedId) ?? flights[0] ?? null;
  const selectedMail = AIRLINE_INBOX.find((thread) => thread.id === mailId) ?? AIRLINE_INBOX[0] ?? null;
  const watched = AIRLINE_INBOX.filter((thread) => thread.watchOnly);
  const booking = selected
    ? bookingFromCounter(selected.counter) ?? bookingFromMail(selectedMail, selected)
    : selectedMail
      ? bookingFromMail(selectedMail, null)
      : null;
  const rights = selected
    ? rightsFromWorkItem(selected)
    : booking
      ? evaluatePassengerRights(
          inferPassengerRightsInputs({
            bookingFound: true,
            origin: booking.origin,
            destination: booking.destination,
            cancelledByCarrier: booking.cancelledByCarrier,
            ticketUnused: booking.ticketUnused,
            flightStatus: booking.flightStatus,
            farePaid: booking.farePaid,
            currency: booking.currency,
            existingClaim: selectedMail?.kind === "claim",
          }),
        )
      : null;

  function selectMail(id: string) {
    setMailId(id);
    const thread = AIRLINE_INBOX.find((entry) => entry.id === id);
    if (!thread || !thread.lastName) return;
    if (thread.watchOnly) {
      setSelectedId(null);
      return;
    }
    const match = flights.find((item) => {
      if (item.identity.providerId !== "flyright") return false;
      if (item.identity.lastName !== thread.lastName) return false;
      return thread.locator === "FR0999" ? item.catalogBlocked : !item.catalogBlocked;
    });
    if (match) setSelectedId(match.id);
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

  async function beginResolution() {
    setPending("begin");
    setActionError(null);
    try {
      await runTheaterTool("begin_resolution", {});
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
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Continue failed.");
    } finally {
      setPending(null);
    }
  }

  async function fileUnsigned(workItemId: string) {
    setPending("execute_filing");
    setActionError(null);
    try {
      await runTheaterTool("execute_filing", { workItemId });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unsigned filing refused.");
    } finally {
      setPending(null);
    }
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText("Check my airline email and tell me what I’m owed.");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setActionError("Clipboard blocked — type the prompt in ChatGPT.");
    }
  }

  const awaiting = flights.some((item) => item.status === "AWAITING_SIGNATURE");
  const approved = flights.some((item) => item.status === "APPROVED");

  return (
    <>
      <FlightDeskWebMcp onStatus={(ready, reason, tools) => setWebmcp({ ready, reason, tools })} />
      <ProductShell
        webmcpReady={webmcp.ready}
        webmcpReason={webmcp.reason}
        inboxConnected={Boolean(theater)}
        researchLive={researchLive}
        toolCount={webmcp.tools.length}
        nextAction={nextActionCopy(theater, webmcp.ready)}
      >
        {loadError ? (
          <div className="desk-card max-w-xl px-6 py-8">
            <p className="text-sm text-[var(--notam)]">Desk failed</p>
            <p className="mt-3 text-lg" role="alert">
              {loadError}
            </p>
            <p className="mt-2 text-sm text-[var(--mist)]">
              Needs theater tables, FlyRight FR1842, and the blocked FR0999 claim.
            </p>
            <button type="button" className="desk-btn desk-btn-solid mt-6" onClick={() => void openSession(true)}>
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-10">
            <section className="grid items-end gap-8 lg:grid-cols-[1.35fr_.65fr]">
              <div>
                <p className="mb-5 inline-flex rounded-full bg-[var(--lime)] px-3 py-1.5 text-xs font-extrabold text-[#172000]">
                  YOUR RIGHTS, ALREADY WORKING
                </p>
                <h1 className="hero-word max-w-5xl font-extrabold">
                  Your flight broke.
                  <br />
                  <span className="font-display font-normal italic text-[var(--blue)]">We build the case.</span>
                </h1>
              </div>
              <div className="pb-2">
                <p className="max-w-md text-lg leading-relaxed text-[var(--muted)]">
                  Aegis reads the airline trail, calculates what you’re owed, and lets your agent file it. You approve
                  the money. You keep all of it.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="desk-btn desk-btn-solid"
                    disabled={Boolean(pending)}
                    onClick={() => void beginResolution()}
                  >
                    {pending === "begin" ? "Building your case…" : "Check this flight"}
                  </button>
                  <button type="button" className="desk-btn" onClick={() => void copyPrompt()}>
                    {copied ? "Prompt copied" : "Use with ChatGPT"}
                  </button>
                </div>
                <dl className="mt-7 grid max-w-md grid-cols-3 gap-4 border-t border-[var(--line)] pt-5">
                  <div>
                    <dt className="text-[11px] font-bold text-[var(--muted)]">SITE TOOLS</dt>
                    <dd className="mt-1 text-xl font-extrabold">{webmcp.tools.length || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-bold text-[var(--muted)]">HUMAN GATES</dt>
                    <dd className="mt-1 text-xl font-extrabold">1</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-bold text-[var(--muted)]">SUCCESS RULE</dt>
                    <dd className="mt-1 text-xl font-extrabold">Match</dd>
                  </div>
                </dl>
              </div>
            </section>

            <div id="agent-flight">
              <ItineraryRibbon
                booking={booking}
                flightNumber={booking?.flightNumber ?? selectedMail?.flightNumber ?? null}
                rights={rights}
                selected={selected}
                blocked={Boolean(selected?.catalogBlocked)}
                empty={!booking}
                pending={pending}
                onSign={(id) => void decide(id, "approved")}
                onDeny={(id) => void decide(id, "denied")}
                onFileUnsigned={(id) => void fileUnsigned(id)}
              />
            </div>

            <JudgeMission
              webmcpReady={webmcp.ready}
              theater={theater}
              item={selected}
              tape={tape}
              pending={pending}
              onBegin={() => void beginResolution()}
              onApprove={(id) => void decide(id, "approved")}
              onContinue={() => void continueResolution()}
              onOpenProvider={() => setDrawerOpen(true)}
            />

            <div className="grid gap-6 lg:grid-cols-12">
              <div id="agent-inbox" className="desk-card p-5 lg:col-span-4">
                <InboxRail
                  threads={AIRLINE_INBOX}
                  selectedId={mailId}
                  connected={Boolean(theater)}
                  loading={pending === "open" || pending === "reset"}
                  error={null}
                  onSelect={selectMail}
                  onConnect={() => void openSession(Boolean(theater))}
                />
              </div>
              <div className="space-y-6 lg:col-span-5">
                <div id="agent-trips" className="desk-card p-5">
                  <TravelGraph
                    items={flights}
                    watched={watched}
                    selectedId={selected?.id ?? null}
                    onSelectItem={setSelectedId}
                  />
                </div>
                <RightsCard item={selected} rights={rights} />
                <EvidenceResearch
                  origin={booking?.origin ?? null}
                  destination={booking?.destination ?? null}
                  cancelled={Boolean(booking?.cancelledByCarrier)}
                  rights={rights}
                  researchLive={researchLive}
                />
                {selectedMail ? (
                  <article className="desk-card p-5">
                    <h3 className="font-display text-2xl italic">{selectedMail.subject}</h3>
                    <p className="mt-1 text-sm text-[var(--mist)]">{selectedMail.fromName}</p>
                    <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-[var(--mist)]">
                      {selectedMail.body}
                    </pre>
                  </article>
                ) : null}
              </div>
              <div className="space-y-6 lg:col-span-3">
                <PermissionSheet
                  items={flights}
                  pending={pending}
                  error={actionError}
                  onApprove={(id) => void decide(id, "approved")}
                  onDeny={(id) => void decide(id, "denied")}
                  onFileUnsigned={(id) => void fileUnsigned(id)}
                />
                <AgentPromptArsenal />
                <AgentTape tape={tape} />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-5">
              <p className="text-sm font-semibold text-[var(--muted)]">
                Every external action is permissioned, replay-safe, and verified at the carrier.
              </p>
              <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="desk-btn"
                disabled={Boolean(pending) || awaiting || !approved}
                onClick={() => void continueResolution()}
              >
                {pending === "continue" ? "Filing and verifying…" : "File approved claim"}
              </button>
              <button type="button" className="desk-btn" onClick={() => setDrawerOpen(true)}>
                Open FlyRight
              </button>
              {selected && !selected.catalogBlocked ? (
                <button
                  type="button"
                  className="desk-btn"
                  disabled={Boolean(pending)}
                  onClick={() => void runTheaterTool("inspect_counter", { workItemId: selected.id })}
                >
                  Inspect booking
                </button>
              ) : null}
              </div>
            </div>
          </div>
        )}
      </ProductShell>
      <FlyRightDrawer item={selected} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}

function bookingFromMail(thread: AirlineMailThread | null, item: TheaterWorkItemSnapshot | null) {
  if (!thread) return null;
  const identity = item?.identity.providerId === "flyright" ? item.identity : null;
  return {
    locator: identity?.locator ?? thread.locator ?? "WATCH",
    lastName: identity?.lastName ?? thread.lastName ?? "",
    flightNumber: thread.flightNumber,
    origin: thread.origin,
    destination: thread.destination,
    departureAt: thread.departureAt,
    farePaid: item?.entitlement?.amount ?? thread.farePaid,
    currency: item?.entitlement?.currency ?? thread.currency ?? "EUR",
    flightStatus: thread.kind === "cancel" || thread.kind === "claim" ? "CANCELLED" : "SCHEDULED",
    cancelledByCarrier: thread.kind === "cancel" || thread.kind === "claim",
    ticketUnused: true,
  };
}
