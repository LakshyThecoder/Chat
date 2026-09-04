"use client";

import { formatMoney } from "@/lib/utils";
import type { TheaterToolPulse } from "@/components/theater/pulse";
import type { TheaterSnapshot, TheaterWorkItemSnapshot } from "@/src/domain/theater/types";

type MissionState = "done" | "active" | "waiting" | "failed";

interface MissionStep {
  key: string;
  label: string;
  proof: string;
  state: MissionState;
}

const REACHED = new Set([
  "INSPECTED",
  "ENTITLED",
  "PREPARED",
  "AWAITING_SIGNATURE",
  "APPROVED",
  "EXECUTED",
  "VERIFIED",
]);

function missionSteps(
  webmcpReady: boolean,
  item: TheaterWorkItemSnapshot | null,
  tape: TheaterToolPulse[],
): MissionStep[] {
  const status = item?.status;
  const inspected = Boolean(status && REACHED.has(status));
  const entitled = Boolean(
    status && ["ENTITLED", "PREPARED", "AWAITING_SIGNATURE", "APPROVED", "EXECUTED", "VERIFIED"].includes(status),
  );
  const asked = Boolean(
    status && ["AWAITING_SIGNATURE", "APPROVED", "DENIED", "EXECUTED", "VERIFIED"].includes(status),
  );
  const approved = item?.approval.state === "approved";
  const filed = status === "EXECUTED" || status === "VERIFIED";
  const verified = status === "VERIFIED" && item?.verification?.matched === true;
  const failed = status === "FAILED";
  const agentUsed = tape.length > 0;

  const raw = [
    {
      key: "bind",
      label: "Agent binds",
      proof: webmcpReady ? "Typed site tools discovered" : "Open in ChatGPT’s browser",
      complete: webmcpReady,
    },
    {
      key: "evidence",
      label: "Evidence read",
      proof: inspected ? "Booking and carrier state observed" : agentUsed ? "Reading provider state" : "Inbox + carrier row",
      complete: inspected,
    },
    {
      key: "rights",
      label: "Rights proved",
      proof: entitled ? "Amount computed by policy code" : "No model arithmetic",
      complete: entitled,
    },
    {
      key: "consent",
      label: "You authorize",
      proof: approved ? "Exact amount signed" : asked ? "Human signature required" : "Agent cannot self-approve",
      complete: approved,
    },
    {
      key: "execute",
      label: "Claim filed",
      proof: filed ? "Idempotent mutation recorded" : "Locked until approval",
      complete: filed,
    },
    {
      key: "verify",
      label: "Carrier matched",
      proof: verified ? "Expected = observed" : "Success requires provider re-read",
      complete: verified,
    },
  ];

  const firstIncomplete = raw.findIndex((step) => !step.complete);
  return raw.map((step, index) => ({
    key: step.key,
    label: step.label,
    proof: step.proof,
    state: failed && index === firstIncomplete ? "failed" : step.complete ? "done" : index === firstIncomplete ? "active" : "waiting",
  }));
}

export function JudgeMission({
  webmcpReady,
  theater,
  item,
  tape,
  pending,
  onBegin,
  onApprove,
  onContinue,
  onOpenProvider,
}: {
  webmcpReady: boolean;
  theater: TheaterSnapshot | null;
  item: TheaterWorkItemSnapshot | null;
  tape: TheaterToolPulse[];
  pending: string | null;
  onBegin: () => void;
  onApprove: (id: string) => void;
  onContinue: () => void;
  onOpenProvider: () => void;
}) {
  const steps = missionSteps(webmcpReady, item, tape);
  const completed = steps.filter((step) => step.state === "done").length;
  const blocked = theater?.items.find((entry) => entry.catalogBlocked);
  const awaiting = item?.status === "AWAITING_SIGNATURE";
  const approved = item?.status === "APPROVED";
  const verified = item?.status === "VERIFIED" && item.verification?.matched;
  const amount = item?.proposal?.amount ?? item?.entitlement?.amount;
  const currency = item?.proposal?.currency ?? item?.entitlement?.currency ?? "EUR";

  return (
    <section className="mission-board" aria-labelledby="mission-heading">
      <div className="mission-head">
        <div>
          <p className="mission-kicker">LIVE JUDGE MISSION · FR1842</p>
          <h2 id="mission-heading" className="font-display text-3xl italic text-white sm:text-4xl">
            Watch the case move—not a slideshow.
          </h2>
        </div>
        <div className="mission-score" aria-label={`${completed} of ${steps.length} steps complete`}>
          <span>{completed}</span> / {steps.length}
        </div>
      </div>

      <ol className="mission-track" aria-label="Live recovery workflow">
        {steps.map((step, index) => (
          <li key={step.key} className="mission-step" data-state={step.state} aria-current={step.state === "active" ? "step" : undefined}>
            <div className="mission-node" aria-hidden>
              {step.state === "done" ? "✓" : String(index + 1).padStart(2, "0")}
            </div>
            <div>
              <p className="mission-label">{step.label}</p>
              <p className="mission-proof">{step.proof}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mission-console">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="mission-proof-chip">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--lime)]" />
            Real state
          </span>
          <span className="mission-proof-chip">Unsigned filing denied</span>
          {blocked ? <span className="mission-proof-chip">Duplicate {blocked.identity.providerId} claim blocked</span> : null}
          {verified ? <span className="mission-proof-chip">Carrier amount matched</span> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {!awaiting && !approved && !verified ? (
            <button type="button" className="mission-action" disabled={Boolean(pending)} onClick={onBegin}>
              {pending === "begin" ? "Building live case…" : "Run live case"}
            </button>
          ) : awaiting && item ? (
            <button type="button" className="mission-action" disabled={Boolean(pending)} onClick={() => onApprove(item.id)}>
              {pending?.startsWith("decide:approved") ? "Signing…" : `Authorize ${formatMoney(amount, currency)}`}
            </button>
          ) : approved ? (
            <button type="button" className="mission-action" disabled={Boolean(pending)} onClick={onContinue}>
              {pending === "continue" ? "Filing + verifying…" : "File and verify"}
            </button>
          ) : (
            <button type="button" className="mission-action" onClick={onOpenProvider}>
              Inspect matched carrier row
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
