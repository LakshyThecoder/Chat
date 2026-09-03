export type ActionRiskClass = "READ" | "PREPARE" | "MUTATE" | "HIGH_IMPACT";

export interface AutonomyPolicy {
  investigateAllowed: boolean;
  prepareAllowed: boolean;
  highImpactAskAboveCents: number;
  killSwitch: boolean;
}

export const DEFAULT_AUTONOMY_POLICY: AutonomyPolicy = {
  investigateAllowed: true,
  prepareAllowed: true,
  highImpactAskAboveCents: 10_000,
  killSwitch: false,
};

export type PermissionDecision = "allow" | "require_approval" | "deny";

export interface PermissionEvaluation {
  decision: PermissionDecision;
  reasons: string[];
}

export interface PermissionInput {
  riskClass: ActionRiskClass;
  amountCents: number | null;
  policy: AutonomyPolicy;
}
