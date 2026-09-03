import { parseDecimalToCents, centsToDecimal } from "@/src/domain/money/cents";
import {
  EligibilityInputError,
  type EligibilityDecision,
  type FlightRefundInputs,
} from "@/src/domain/eligibility/types";

const POLICY_RULE = "flyright.carrier_cancel_unused_fare.v2026.09";

/**
 * Deterministic unused-fare refund. Amount is always the booking fare when eligible.
 * Never a hardcoded euro constant.
 */
export function evaluateFlightRefund(input: FlightRefundInputs): EligibilityDecision {
  if (!input.bookingFound) {
    return {
      outcome: "uncertain",
      amount: null,
      currency: input.currency,
      ruleIds: [],
      reasons: ["No booking matched the locator and last name."],
    };
  }

  if (!input.farePaid) {
    return {
      outcome: "uncertain",
      amount: null,
      currency: input.currency,
      ruleIds: [POLICY_RULE],
      reasons: ["Booking is missing a fare. Eligibility cannot be completed."],
    };
  }

  let fareCents: number;
  try {
    fareCents = parseDecimalToCents(input.farePaid);
  } catch {
    throw new EligibilityInputError(`Fare is not a valid decimal: ${input.farePaid}`);
  }

  if (input.existingClaim) {
    return {
      outcome: "ineligible",
      amount: null,
      currency: input.currency,
      ruleIds: [POLICY_RULE],
      reasons: ["A claim already exists for this booking at the carrier."],
    };
  }

  const cancelled =
    input.cancelledByCarrier || input.flightStatus?.toUpperCase() === "CANCELLED";

  if (!cancelled) {
    return {
      outcome: "ineligible",
      amount: null,
      currency: input.currency,
      ruleIds: [POLICY_RULE],
      reasons: [
        `Flight status is ${input.flightStatus ?? "unknown"}. Unused-fare refund applies only to carrier cancellations.`,
      ],
    };
  }

  if (!input.ticketUnused) {
    return {
      outcome: "ineligible",
      amount: null,
      currency: input.currency,
      ruleIds: [POLICY_RULE],
      reasons: ["The ticket is marked used. Unused-fare refund does not apply."],
    };
  }

  return {
    outcome: "eligible",
    amount: centsToDecimal(fareCents),
    currency: input.currency,
    ruleIds: [POLICY_RULE],
    reasons: [
      "Carrier cancelled the flight and the ticket is unused. Refund equals the fare paid on the booking.",
    ],
  };
}
