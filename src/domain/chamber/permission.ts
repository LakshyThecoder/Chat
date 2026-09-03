export type ChamberApproval = "unsigned" | "approved" | "denied";

export class ChamberPermissionError extends Error {
  readonly code:
    | "APPROVAL_REQUIRED"
    | "DENIED"
    | "EXPIRED"
    | "WRONG_TICKET"
    | "AMOUNT_MISMATCH"
    | "NOT_ELIGIBLE";

  constructor(
    code:
      | "APPROVAL_REQUIRED"
      | "DENIED"
      | "EXPIRED"
      | "WRONG_TICKET"
      | "AMOUNT_MISMATCH"
      | "NOT_ELIGIBLE",
    message: string,
  ) {
    super(message);
    this.name = "ChamberPermissionError";
    this.code = code;
  }
}

export function deriveChamberApproval(input: {
  approvedAt: string | null;
  deniedAt: string | null;
}): ChamberApproval {
  if (input.deniedAt) {
    return "denied";
  }
  if (input.approvedAt) {
    return "approved";
  }
  return "unsigned";
}

export function assertChamberSubmit(input: {
  now: Date;
  expiresAt: string;
  approvedAt: string | null;
  deniedAt: string | null;
  sessionLocator: string;
  sessionLastName: string;
  requestedLocator: string;
  requestedLastName: string;
  approvedAmount: string | null;
  requestedAmount: string;
}): void {
  if (input.now.getTime() > new Date(input.expiresAt).getTime()) {
    throw new ChamberPermissionError(
      "EXPIRED",
      "This chamber ticket has expired. Issue a fresh ticket on the page.",
    );
  }

  if (input.deniedAt) {
    throw new ChamberPermissionError(
      "DENIED",
      "The human denied this filing. The agent cannot submit it.",
    );
  }

  if (!input.approvedAt) {
    throw new ChamberPermissionError(
      "APPROVAL_REQUIRED",
      "Human signature required. Ask the person on this page to sign before submit_claim.",
    );
  }

  const sessionLocator = input.sessionLocator.trim().toUpperCase();
  const requestedLocator = input.requestedLocator.trim().toUpperCase();
  const sessionLastName = input.sessionLastName.trim().toUpperCase();
  const requestedLastName = input.requestedLastName.trim().toUpperCase();

  if (sessionLocator !== requestedLocator || sessionLastName !== requestedLastName) {
    throw new ChamberPermissionError(
      "WRONG_TICKET",
      `This chamber is holding ${sessionLocator} / ${sessionLastName}. submit_claim cannot file a different booking.`,
    );
  }

  if (!input.approvedAmount) {
    throw new ChamberPermissionError(
      "NOT_ELIGIBLE",
      "No eligible amount was signed. Calculate compensation, then ask the human to sign that amount.",
    );
  }

  if (input.approvedAmount !== input.requestedAmount) {
    throw new ChamberPermissionError(
      "AMOUNT_MISMATCH",
      `Signed amount is ${input.approvedAmount}. Submitted amount ${input.requestedAmount} does not match.`,
    );
  }
}
