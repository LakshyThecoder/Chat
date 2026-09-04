import { evaluateFlightRefund } from "@/src/domain/eligibility/evaluate-flight-refund";
import { greatCircleKm, regionForAirport } from "@/src/domain/eligibility/airports";
import type {
  EligibilityDecision,
  PassengerRightsDecision,
  PassengerRightsInputs,
  RecoverableLine,
  RightsRegime,
} from "@/src/domain/eligibility/types";

const EU261_RULE = "eu261.delay_cancel.v2026.09";
const UK261_RULE = "uk261.delay_cancel.v2026.09";
const DOT_RULE = "usdot.significant_change_refund.v2026.09";

/** Statutory cash bands from Regulation 261/2004 — not invented amounts. */
const EU261_BANDS = [
  { maxKm: 1500, amount: "250.00" },
  { maxKm: 3500, amount: "400.00" },
  { maxKm: Number.POSITIVE_INFINITY, amount: "600.00" },
] as const;

/** UK retained 261 bands in GBP. */
const UK261_BANDS = [
  { maxKm: 1500, amount: "220.00" },
  { maxKm: 3500, amount: "350.00" },
  { maxKm: Number.POSITIVE_INFINITY, amount: "520.00" },
] as const;

function bandAmount(distanceKm: number, bands: typeof EU261_BANDS | typeof UK261_BANDS): string {
  const last = bands[bands.length - 1];
  for (const band of bands) {
    if (distanceKm <= band.maxKm) return band.amount;
  }
  return last?.amount ?? "600.00";
}

function emptyDecision(currency: string, ruleIds: string[], reasons: string[]): EligibilityDecision {
  return { outcome: "ineligible", amount: null, currency, ruleIds, reasons };
}

function eu261Applies(input: PassengerRightsInputs): boolean {
  return input.departedFromRegion === "EU" || (input.arrivedInRegion === "EU" && input.operatingCarrierRegion === "EU");
}

function uk261Applies(input: PassengerRightsInputs): boolean {
  return input.departedFromRegion === "UK" || (input.arrivedInRegion === "UK" && input.operatingCarrierRegion === "UK");
}

function disruptionQualifies(input: PassengerRightsInputs): { ok: boolean; reason: string } {
  const cancelled = input.cancelledByCarrier || input.flightStatus?.toUpperCase() === "CANCELLED";
  if (cancelled) {
    if (input.noticeDaysBeforeDeparture !== null && input.noticeDaysBeforeDeparture >= 14) {
      return { ok: false, reason: "Cancellation notice was 14 days or more before departure." };
    }
    return { ok: true, reason: "Carrier cancelled with short notice." };
  }
  if (input.arrivalDelayMinutes !== null && input.arrivalDelayMinutes >= 180) {
    return { ok: true, reason: `Arrival delay of ${input.arrivalDelayMinutes} minutes meets the 3-hour threshold.` };
  }
  return { ok: false, reason: "No qualifying delay or short-notice cancellation on the observed facts." };
}

function evaluateStatutory(
  input: PassengerRightsInputs,
  regime: "EU261" | "UK261",
  distanceKm: number | null,
): EligibilityDecision {
  const rule = regime === "EU261" ? EU261_RULE : UK261_RULE;
  const currency = regime === "EU261" ? "EUR" : "GBP";
  const applies = regime === "EU261" ? eu261Applies(input) : uk261Applies(input);

  if (!input.bookingFound) {
    return { outcome: "uncertain", amount: null, currency, ruleIds: [], reasons: ["No booking matched."] };
  }
  if (!applies) {
    return emptyDecision(currency, [rule], [`${regime} does not apply to this itinerary.`]);
  }
  if (input.existingClaim) {
    return emptyDecision(currency, [rule], ["A claim already exists for this booking at the carrier."]);
  }
  if (input.extraordinaryCircumstances === true) {
    return emptyDecision(currency, [rule], [
      `${regime} cash is not due when extraordinary circumstances are proven. This engine does not invent weather or ATC facts.`,
    ]);
  }
  if (distanceKm === null) {
    return {
      outcome: "uncertain",
      amount: null,
      currency,
      ruleIds: [rule],
      reasons: ["Distance cannot be computed — origin or destination IATA is unknown."],
    };
  }

  const disruption = disruptionQualifies(input);
  if (!disruption.ok) {
    return emptyDecision(currency, [rule], [disruption.reason]);
  }

  const amount = bandAmount(distanceKm, regime === "EU261" ? EU261_BANDS : UK261_BANDS);
  const reasons = [
    `${regime} applies. Great-circle distance ${distanceKm} km.`,
    disruption.reason,
    `Statutory cash band is ${regime === "EU261" ? "€" : "£"}${amount} per passenger.`,
  ];
  if (input.extraordinaryCircumstances === null) {
    reasons.push("Cause is not proven extraordinary. The airline must prove that defence.");
  }

  return { outcome: "eligible", amount, currency, ruleIds: [rule], reasons };
}

function evaluateDot(input: PassengerRightsInputs): EligibilityDecision {
  const cancelled = input.cancelledByCarrier || input.flightStatus?.toUpperCase() === "CANCELLED";
  const domestic = input.departedFromRegion === "US" && input.arrivedInRegion === "US";
  const touchesUs =
    input.departedFromRegion === "US" || input.arrivedInRegion === "US" || input.operatingCarrierRegion === "US";

  if (!input.bookingFound) {
    return { outcome: "uncertain", amount: null, currency: input.currency, ruleIds: [], reasons: ["No booking matched."] };
  }
  if (!touchesUs) {
    return emptyDecision(input.currency, [DOT_RULE], ["US DOT refund rules do not apply to this itinerary."]);
  }
  if (input.existingClaim) {
    return emptyDecision(input.currency, [DOT_RULE], ["A claim already exists for this booking at the carrier."]);
  }

  const significantDelay =
    input.arrivalDelayMinutes !== null &&
    ((domestic && input.arrivalDelayMinutes >= 180) || (!domestic && input.arrivalDelayMinutes >= 360));

  if (!cancelled && !significantDelay) {
    return emptyDecision(input.currency, [DOT_RULE], [
      "DOT does not pay delay cash. Automatic refund requires a cancellation or a significant schedule change.",
    ]);
  }
  if (!input.farePaid) {
    return {
      outcome: "uncertain",
      amount: null,
      currency: input.currency,
      ruleIds: [DOT_RULE],
      reasons: ["Fare is missing. DOT refund cannot be completed."],
    };
  }

  return {
    outcome: "eligible",
    amount: input.farePaid,
    currency: input.currency,
    ruleIds: [DOT_RULE],
    reasons: [
      cancelled
        ? "US DOT: cancelled itinerary — passenger who declines rebooking is owed an automatic fare refund."
        : "US DOT: significant schedule change — fare refund if the passenger declines the new itinerary.",
    ],
  };
}

export function inferPassengerRightsInputs(partial: {
  bookingFound: boolean;
  origin: string | null;
  destination: string | null;
  cancelledByCarrier: boolean;
  ticketUnused: boolean;
  flightStatus: string | null;
  farePaid: string | null;
  currency: string;
  existingClaim: boolean;
  arrivalDelayMinutes?: number | null;
  noticeDaysBeforeDeparture?: number | null;
  extraordinaryCircumstances?: boolean | null;
  operatingCarrierRegion?: PassengerRightsInputs["operatingCarrierRegion"];
}): PassengerRightsInputs {
  return {
    bookingFound: partial.bookingFound,
    origin: partial.origin,
    destination: partial.destination,
    cancelledByCarrier: partial.cancelledByCarrier,
    ticketUnused: partial.ticketUnused,
    flightStatus: partial.flightStatus,
    farePaid: partial.farePaid,
    currency: partial.currency,
    existingClaim: partial.existingClaim,
    arrivalDelayMinutes: partial.arrivalDelayMinutes ?? null,
    noticeDaysBeforeDeparture: partial.noticeDaysBeforeDeparture ?? (partial.cancelledByCarrier ? 2 : null),
    extraordinaryCircumstances: partial.extraordinaryCircumstances ?? null,
    operatingCarrierRegion: partial.operatingCarrierRegion ?? regionForAirport(partial.origin),
    departedFromRegion: regionForAirport(partial.origin),
    arrivedInRegion: regionForAirport(partial.destination),
  };
}

/**
 * Deterministic passenger-rights stack.
 * Filing amount for the FlyRight sandbox remains the unused-fare refund.
 * Statutory EU261/UK261/DOT lines are computed separately and never invented by a model.
 */
export function evaluatePassengerRights(input: PassengerRightsInputs): PassengerRightsDecision {
  const distanceKm = greatCircleKm(input.origin, input.destination);
  const fare = evaluateFlightRefund({
    bookingFound: input.bookingFound,
    cancelledByCarrier: input.cancelledByCarrier,
    ticketUnused: input.ticketUnused,
    flightStatus: input.flightStatus,
    farePaid: input.farePaid,
    currency: input.currency,
    existingClaim: input.existingClaim,
  });

  const lines: RecoverableLine[] = [
    { kind: "fare_refund", regime: "FARE_REFUND", decision: fare },
  ];

  const applicableRegimes: RightsRegime[] = fare.outcome === "eligible" ? ["FARE_REFUND"] : [];

  if (eu261Applies(input)) {
    const eu = evaluateStatutory(input, "EU261", distanceKm);
    lines.push({ kind: "statutory_compensation", regime: "EU261", decision: eu });
    if (eu.outcome === "eligible") applicableRegimes.push("EU261");
  } else if (uk261Applies(input)) {
    const uk = evaluateStatutory(input, "UK261", distanceKm);
    lines.push({ kind: "statutory_compensation", regime: "UK261", decision: uk });
    if (uk.outcome === "eligible") applicableRegimes.push("UK261");
  }

  const touchesUs =
    input.departedFromRegion === "US" || input.arrivedInRegion === "US" || input.operatingCarrierRegion === "US";
  if (touchesUs) {
    const dot = evaluateDot(input);
    lines.push({ kind: "dot_refund", regime: "DOT", decision: dot });
    if (dot.outcome === "eligible") applicableRegimes.push("DOT");
  }

  if (applicableRegimes.length === 0) {
    applicableRegimes.push("NONE");
  }

  return {
    filing: fare,
    lines,
    distanceKm,
    applicableRegimes,
  };
}
