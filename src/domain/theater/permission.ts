import type { TheaterWorkItemStatus } from "@/src/domain/theater/types";

export class TheaterPermissionError extends Error {
  readonly code:
    | "APPROVAL_REQUIRED"
    | "DENIED"
    | "EXPIRED"
    | "STATE"
    | "AMOUNT_MISMATCH"
    | "NOT_ELIGIBLE";

  constructor(
    code:
      | "APPROVAL_REQUIRED"
      | "DENIED"
      | "EXPIRED"
      | "STATE"
      | "AMOUNT_MISMATCH"
      | "NOT_ELIGIBLE",
    message: string,
  ) {
    super(message);
    this.name = "TheaterPermissionError";
    this.code = code;
  }
}

export type TheaterApprovalState = "unsigned" | "approved" | "denied";

export function deriveTheaterApproval(input: {
  approvedAt: string | null;
  deniedAt: string | null;
}): TheaterApprovalState {
  if (input.deniedAt) {
    return "denied";
  }
  if (input.approvedAt) {
    return "approved";
  }
  return "unsigned";
}

export function assertTheaterExecute(input: {
  now: Date;
  expiresAt: string;
  status: TheaterWorkItemStatus;
  approvedAt: string | null;
  deniedAt: string | null;
  proposalAmount: string | null;
  proposalCurrency: string | null;
  approvedAmount: string | null;
  approvedCurrency: string | null;
}): void {
  if (input.now.getTime() > new Date(input.expiresAt).getTime()) {
    throw new TheaterPermissionError(
      "EXPIRED",
      "This theater session has expired. Refresh the page to issue a new session.",
    );
  }

  if (input.deniedAt) {
    throw new TheaterPermissionError(
      "DENIED",
      "The human denied this filing. The agent cannot execute it.",
    );
  }

  if (!input.approvedAt) {
    throw new TheaterPermissionError(
      "APPROVAL_REQUIRED",
      "Human signature required. Ask the person on this page to approve the prepared filing.",
    );
  }

  if (
    input.status !== "APPROVED" &&
    input.status !== "EXECUTED" &&
    input.status !== "VERIFIED" &&
    input.status !== "FAILED"
  ) {
    throw new TheaterPermissionError(
      "STATE",
      `Work item is not executable from state ${input.status}. Sign the prepared amount first.`,
    );
  }

  if (!input.proposalAmount || !input.proposalCurrency) {
    throw new TheaterPermissionError(
      "NOT_ELIGIBLE",
      "No eligible amount is prepared. Inspect and compute entitlement before execution.",
    );
  }

  if (!input.approvedAmount || !input.approvedCurrency) {
    throw new TheaterPermissionError(
      "NOT_ELIGIBLE",
      "No amount was signed. Ask the human to approve the prepared amount.",
    );
  }

  if (input.proposalAmount !== input.approvedAmount || input.proposalCurrency !== input.approvedCurrency) {
    throw new TheaterPermissionError(
      "AMOUNT_MISMATCH",
      `Signed ${input.approvedAmount} ${input.approvedCurrency} does not match prepared ${input.proposalAmount} ${input.proposalCurrency}.`,
    );
  }
}

