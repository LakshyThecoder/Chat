import { parseDecimalToCents, centsToDecimal } from "@/src/domain/money/cents";
import {
  EligibilityInputError,
  type EligibilityDecision,
  type SubscriptionRefundInputs,
} from "@/src/domain/eligibility/types";

const POLICY_RULE = "streamly.billed_after_cancel.v2026.09";

/**
 * Deterministic billed-after-cancel refund. Amount is the later charge on the subscription.
 */
export function evaluateSubscriptionRefund(input: SubscriptionRefundInputs): EligibilityDecision {
  if (!input.subscriptionFound) {
    return {
      outcome: "uncertain",
      amount: null,
      currency: input.currency,
      ruleIds: [],
      reasons: ["No Streamly subscription matched the account email and subscription id."],
    };
  }

  if (input.existingRefund) {
    return {
      outcome: "ineligible",
      amount: null,
      currency: input.currency,
      ruleIds: [POLICY_RULE],
      reasons: ["A refund already exists for this Streamly subscription."],
    };
  }

  if (input.status !== "cancelled" || !input.cancelledAt) {
    return {
      outcome: "ineligible",
      amount: null,
      currency: input.currency,
      ruleIds: [POLICY_RULE],
      reasons: ["The plan is still active. Billed-after-cancel refund applies only after cancellation."],
    };
  }

  if (!input.lastChargeAmount) {
    return {
      outcome: "uncertain",
      amount: null,
      currency: input.currency,
      ruleIds: [POLICY_RULE],
      reasons: ["Subscription is missing the later charge amount. Eligibility cannot be completed."],
    };
  }

  let chargeCents: number;
  try {
    chargeCents = parseDecimalToCents(input.lastChargeAmount);
  } catch {
    throw new EligibilityInputError(`Charge is not a valid decimal: ${input.lastChargeAmount}`);
  }

  const cancelledAt = Date.parse(input.cancelledAt);
  const lastChargedAt = Date.parse(input.lastChargedAt ?? "");
  if (Number.isNaN(cancelledAt) || Number.isNaN(lastChargedAt)) {
    return {
      outcome: "uncertain",
      amount: null,
      currency: input.currency,
      ruleIds: [POLICY_RULE],
      reasons: ["Cancellation or charge timestamps are missing. Eligibility cannot be completed."],
    };
  }

  if (lastChargedAt <= cancelledAt) {
    return {
      outcome: "ineligible",
      amount: null,
      currency: input.currency,
      ruleIds: [POLICY_RULE],
      reasons: ["The last charge was not posted after cancellation."],
    };
  }

  return {
    outcome: "eligible",
    amount: centsToDecimal(chargeCents),
    currency: input.currency,
    ruleIds: [POLICY_RULE],
    reasons: [
      "The subscription was cancelled and a later charge posted. Refund equals that later charge.",
    ],
  };
}
