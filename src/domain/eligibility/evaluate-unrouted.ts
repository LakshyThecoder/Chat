import type { EligibilityDecision } from "@/src/domain/eligibility/types";

export function evaluateUnroutedMessage(currency: string): EligibilityDecision {
  return {
    outcome: "uncertain",
    amount: null,
    currency,
    ruleIds: [],
    reasons: [
      "This message is not tied to a provider counter. Aegis will not invent an amount or a claim.",
    ],
  };
}
