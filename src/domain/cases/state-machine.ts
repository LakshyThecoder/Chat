export const CASE_STATUSES = [
  "DRAFT",
  "INVESTIGATING",
  "READY_FOR_REVIEW",
  "AWAITING_APPROVAL",
  "EXECUTING",
  "SUBMITTED",
  "UNDER_REVIEW",
  "NEEDS_INFORMATION",
  "RESOLVED",
  "FAILED",
  "CLOSED",
] as const;

export type CaseStatus = (typeof CASE_STATUSES)[number];

export const CASE_TRANSITIONS: Record<CaseStatus, readonly CaseStatus[]> = {
  DRAFT: ["INVESTIGATING"],
  INVESTIGATING: ["READY_FOR_REVIEW"],
  READY_FOR_REVIEW: ["AWAITING_APPROVAL", "EXECUTING"],
  AWAITING_APPROVAL: ["EXECUTING", "READY_FOR_REVIEW"],
  EXECUTING: ["SUBMITTED", "FAILED"],
  SUBMITTED: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["NEEDS_INFORMATION", "RESOLVED"],
  NEEDS_INFORMATION: ["UNDER_REVIEW"],
  RESOLVED: ["CLOSED"],
  FAILED: [],
  CLOSED: [],
};

export class IllegalCaseTransitionError extends Error {
  readonly code = "ILLEGAL_CASE_TRANSITION";

  constructor(
    readonly from: CaseStatus,
    readonly to: CaseStatus,
  ) {
    super(`Illegal case transition: ${from} → ${to}`);
    this.name = "IllegalCaseTransitionError";
  }
}

export function canTransitionCaseStatus(from: CaseStatus, to: CaseStatus): boolean {
  return CASE_TRANSITIONS[from].includes(to);
}

/**
 * READY_FOR_REVIEW → EXECUTING is only legal when autonomy policy allows it.
 * The permission engine must pass `autonomousExecutionAllowed=true` explicitly.
 */
export function assertCaseTransition(
  from: CaseStatus,
  to: CaseStatus,
  options: { autonomousExecutionAllowed?: boolean } = {},
): void {
  if (!canTransitionCaseStatus(from, to)) {
    throw new IllegalCaseTransitionError(from, to);
  }

  if (from === "READY_FOR_REVIEW" && to === "EXECUTING" && !options.autonomousExecutionAllowed) {
    throw new IllegalCaseTransitionError(from, to);
  }
}
