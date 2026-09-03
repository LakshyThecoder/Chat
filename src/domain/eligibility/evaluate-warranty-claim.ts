import { parseDecimalToCents, centsToDecimal } from "@/src/domain/money/cents";
import {
  EligibilityInputError,
  type EligibilityDecision,
  type WarrantyClaimInputs,
} from "@/src/domain/eligibility/types";

const POLICY_RULE = "electromart.in_warranty_defect.v2026.09";

export function warrantyEndsAt(purchasedAt: string, warrantyMonths: number): Date {
  const start = new Date(purchasedAt);
  if (Number.isNaN(start.getTime()) || !Number.isInteger(warrantyMonths) || warrantyMonths <= 0) {
    throw new EligibilityInputError("Warranty window cannot be calculated from the order.");
  }
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + warrantyMonths);
  return end;
}

/**
 * Deterministic in-warranty claim. Amount is the purchase price on the order.
 */
export function evaluateWarrantyClaim(input: WarrantyClaimInputs): EligibilityDecision {
  if (!input.orderFound) {
    return {
      outcome: "uncertain",
      amount: null,
      currency: input.currency,
      ruleIds: [],
      reasons: ["No ElectroMart order matched the order id and last name."],
    };
  }

  if (input.existingClaim) {
    return {
      outcome: "ineligible",
      amount: null,
      currency: input.currency,
      ruleIds: [POLICY_RULE],
      reasons: ["A warranty claim already exists for this order."],
    };
  }

  if (input.returnOpened) {
    return {
      outcome: "ineligible",
      amount: null,
      currency: input.currency,
      ruleIds: [POLICY_RULE],
      reasons: ["A return is already open on this order. Warranty claim does not apply."],
    };
  }

  if (!input.purchasePrice) {
    return {
      outcome: "uncertain",
      amount: null,
      currency: input.currency,
      ruleIds: [POLICY_RULE],
      reasons: ["Order is missing a purchase price. Eligibility cannot be completed."],
    };
  }

  let priceCents: number;
  try {
    priceCents = parseDecimalToCents(input.purchasePrice);
  } catch {
    throw new EligibilityInputError(`Purchase price is not a valid decimal: ${input.purchasePrice}`);
  }

  let endsAt: Date;
  try {
    endsAt = warrantyEndsAt(input.purchasedAt ?? "", input.warrantyMonths ?? 0);
  } catch {
    return {
      outcome: "uncertain",
      amount: null,
      currency: input.currency,
      ruleIds: [POLICY_RULE],
      reasons: ["Warranty window cannot be calculated from the order."],
    };
  }

  const asOf = input.asOf ? new Date(input.asOf) : new Date();
  if (Number.isNaN(asOf.getTime()) || asOf.getTime() > endsAt.getTime()) {
    return {
      outcome: "ineligible",
      amount: null,
      currency: input.currency,
      ruleIds: [POLICY_RULE],
      reasons: ["The warranty window on this order has closed."],
    };
  }

  return {
    outcome: "eligible",
    amount: centsToDecimal(priceCents),
    currency: input.currency,
    ruleIds: [POLICY_RULE],
    reasons: [
      "The order is inside the warranty window and no return or claim is open. Claim amount equals the purchase price.",
    ],
  };
}
