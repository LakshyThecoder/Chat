"use client";

import { formatMoney } from "@/lib/utils";
import { lookupAirport } from "@/src/domain/eligibility/airports";
import type { PassengerRightsDecision } from "@/src/domain/eligibility/types";
import type { ObservedBooking } from "@/src/domain/flight-desk/rights-from-item";
import type { TheaterWorkItemSnapshot } from "@/src/domain/theater/types";

function boardTime(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Paris",
  }).format(new Date(iso));
}

function boardDate(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(new Date(iso));
}

export function ItineraryRibbon({
  booking,
  flightNumber,
  rights,
  selected,
  blocked,
  empty,
  pending,
  onSign,
  onDeny,
  onFileUnsigned,
}: {
  booking: ObservedBooking | null;
  flightNumber: string | null;
  rights: PassengerRightsDecision | null;
  selected: TheaterWorkItemSnapshot | null;
  blocked: boolean;
  empty: boolean;
  pending: string | null;
  onSign: (id: string) => void;
  onDeny: (id: string) => void;
  onFileUnsigned: (id: string) => void;
}) {
  if (empty) {
    return (
      <section className="flight-card min-h-[34rem] animate-pulse p-7 sm:p-10" aria-labelledby="ribbon-heading">
        <p className="text-sm font-bold text-white/50">Opening your protected trip…</p>
        <h2 id="ribbon-heading" className="mt-5 max-w-2xl text-5xl font-extrabold tracking-[-0.06em] text-white">
          Reading the carrier row and rebuilding your itinerary.
        </h2>
      </section>
    );
  }

  const origin = booking?.origin ?? "—";
  const destination = booking?.destination ?? "—";
  const cancelled = Boolean(booking?.cancelledByCarrier || booking?.flightStatus === "CANCELLED");
  const filing = selected?.entitlement ?? rights?.filing;
  const statutory = rights?.lines.find((line) => line.kind === "statutory_compensation");
  const awaiting = selected?.status === "AWAITING_SIGNATURE" && !blocked;
  const amount = selected?.proposal?.amount ?? filing?.amount;
  const currency = selected?.proposal?.currency ?? filing?.currency ?? "EUR";
  const recoveryLabel =
    selected?.status === "VERIFIED"
      ? "Recovered and carrier-verified"
      : selected?.status === "APPROVED"
        ? "Approved filing amount"
        : awaiting
          ? "Waiting for your signature"
          : "Refund identified";

  return (
    <section className="flight-card p-5 sm:p-8" aria-labelledby="ribbon-heading">
      <div className="relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white/75">
            {flightNumber ?? booking?.flightNumber ?? "FLIGHT"} · {boardDate(booking?.departureAt ?? null)}
          </span>
          <span className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${cancelled ? "bg-[#ff6258] text-white" : "bg-white/10 text-white"}`}>
            {cancelled ? "CANCELLED BY CARRIER" : booking?.flightStatus ?? "WATCHING"}
          </span>
        </div>

        <div className="route-board mt-10 flex items-center gap-5 sm:gap-8">
          <div className="min-w-0">
            <p id="ribbon-heading" className="text-4xl font-extrabold tracking-[-0.06em] sm:text-7xl">{origin}</p>
            <p className="mt-2 truncate text-xs text-white/55 sm:text-sm">{lookupAirport(origin)?.name ?? origin}</p>
          </div>
          <div className="route-line" aria-hidden />
          <div className="min-w-0 text-right">
            <p className="text-4xl font-extrabold tracking-[-0.06em] sm:text-7xl">{destination}</p>
            <p className="mt-2 truncate text-xs text-white/55 sm:text-sm">{lookupAirport(destination)?.name ?? destination}</p>
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
            <p className="text-xs font-bold text-white/45">SCHEDULED</p>
            <p className="mt-1 text-2xl font-extrabold">{boardTime(booking?.departureAt ?? null)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
            <p className="text-xs font-bold text-white/45">ACTUAL</p>
            <p className={`mt-1 text-2xl font-extrabold ${cancelled ? "text-[#ff7770]" : ""}`}>
              {cancelled ? "DID NOT FLY" : boardTime(booking?.departureAt ?? null)}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
            <p className="text-xs font-bold text-white/45">RIGHTS</p>
            <p className="mt-1 text-2xl font-extrabold">{rights?.applicableRegimes.join(" + ") ?? "Reviewing"}</p>
          </div>
        </div>

        <div className="claim-panel mt-5 grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] opacity-60">{recoveryLabel}</p>
            <p className="mt-1 text-5xl font-extrabold tracking-[-0.06em] sm:text-6xl">
              {filing?.outcome === "eligible" ? formatMoney(amount, currency) : filing?.outcome ?? "Reviewing"}
            </p>
            <p className="mt-2 max-w-xl text-sm font-medium opacity-70">
              Your unused fare, calculated from the live booking. No fee. No percentage taken.
            </p>
            {statutory?.decision.outcome === "eligible" ? (
              <p className="mt-2 text-sm font-bold">
                Separate statutory claim: {formatMoney(statutory.decision.amount, statutory.decision.currency)} under {statutory.regime}
                {rights?.distanceKm ? ` · ${rights.distanceKm} km` : ""}
              </p>
            ) : null}
          </div>
          <div className="flex min-w-[13rem] flex-col gap-2">
          {blocked ? (
            <p className="rounded-xl border border-black/20 px-3 py-3 text-sm font-bold">
              FR0999 / BERG is blocked. Do not sign. Do not file.
            </p>
          ) : awaiting && selected ? (
            <>
              <button
                type="button"
                className="min-h-12 rounded-xl bg-[var(--night)] px-5 font-extrabold text-white"
                disabled={Boolean(pending)}
                onClick={() => onSign(selected.id)}
              >
                {pending?.startsWith("decide:approved") ? "Approving…" : `Approve ${formatMoney(amount, currency)}`}
              </button>
              <button type="button" className="min-h-11 text-sm font-bold opacity-60" disabled={Boolean(pending)} onClick={() => onDeny(selected.id)}>
                Don’t file
              </button>
            </>
          ) : selected && !blocked ? (
            <button
              type="button"
              className="min-h-12 rounded-xl border border-black/20 px-5 font-bold"
              disabled={Boolean(pending)}
              onClick={() => onFileUnsigned(selected.id)}
            >
              Test permission boundary
            </button>
          ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
