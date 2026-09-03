import type { PermissionEvaluation, PermissionInput } from "@/src/domain/permissions/types";

export function evaluatePermission(input: PermissionInput): PermissionEvaluation {
  const { policy, riskClass, amountCents } = input;

  if (policy.killSwitch && (riskClass === "MUTATE" || riskClass === "HIGH_IMPACT")) {
    return {
      decision: "deny",
      reasons: ["Kill switch is on. Consequential actions are blocked."],
    };
  }

  if (riskClass === "READ") {
    return { decision: "allow", reasons: ["Read actions are permitted."] };
  }

  if (riskClass === "PREPARE") {
    if (!policy.prepareAllowed) {
      return { decision: "deny", reasons: ["Preparing claims is disabled in autonomy settings."] };
    }
    return { decision: "allow", reasons: ["Preparing a claim is allowed."] };
  }

  if (riskClass === "MUTATE" || riskClass === "HIGH_IMPACT") {
    if (amountCents === null) {
      return {
        decision: "require_approval",
        reasons: ["Amount is unknown. Consequential actions cannot run automatically."],
      };
    }

    if (amountCents > policy.highImpactAskAboveCents) {
      return {
        decision: "require_approval",
        reasons: [
          `Amount exceeds the automatic limit of ${(policy.highImpactAskAboveCents / 100).toFixed(2)} in major units.`,
        ],
      };
    }

    return {
      decision: "allow",
      reasons: ["Amount is within the configured automatic threshold."],
    };
  }

  return { decision: "deny", reasons: ["Unknown action class."] };
}
