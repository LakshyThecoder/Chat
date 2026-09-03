import { TheaterPermissionError } from "@/src/domain/theater/permission";
import { TheaterSessionError } from "@/src/domain/theater/errors";
import type { TheaterWorkItemStatus } from "@/src/domain/theater/types";

export const PROPOSAL_LOCKED_STATUSES: readonly TheaterWorkItemStatus[] = [
  "AWAITING_SIGNATURE",
  "APPROVED",
  "EXECUTED",
  "VERIFIED",
];

export function sessionIsExpired(now: Date, expiresAt: string): boolean {
  return now.getTime() > new Date(expiresAt).getTime();
}

export function assertSessionNotExpired(now: Date, expiresAt: string): void {
  if (sessionIsExpired(now, expiresAt)) {
    throw new TheaterSessionError(
      "SESSION_EXPIRED",
      "This theater session has expired. Issue a fresh desk.",
      409,
    );
  }
}

export function nextActionsFor(input: {
  status: TheaterWorkItemStatus;
  catalogBlocked: boolean;
  eligible: boolean | null;
  hasMutation: boolean;
}): string[] {
  if (input.catalogBlocked || input.eligible === false) {
    if (input.status === "UNINSPECTED") {
      return ["inspect_counter", "compute_entitlement"];
    }
    if (input.status === "INSPECTED") {
      return ["compute_entitlement"];
    }
    return [];
  }

  switch (input.status) {
    case "UNINSPECTED":
      return ["inspect_counter"];
    case "INSPECTED":
      return ["compute_entitlement"];
    case "ENTITLED":
      return ["prepare_filing"];
    case "PREPARED":
      return ["request_signature"];
    case "AWAITING_SIGNATURE":
      return [];
    case "APPROVED":
      return ["execute_filing"];
    case "EXECUTED":
      return ["verify_filing"];
    case "VERIFIED":
      return [];
    case "DENIED":
      return [];
    case "FAILED":
      return input.hasMutation ? ["verify_filing"] : ["execute_filing"];
    default:
      return [];
  }
}

export function inspectNextStatus(current: TheaterWorkItemStatus): TheaterWorkItemStatus {
  return current === "UNINSPECTED" ? "INSPECTED" : current;
}

export function entitleNextStatus(current: TheaterWorkItemStatus): TheaterWorkItemStatus {
  if (current === "UNINSPECTED" || current === "INSPECTED") {
    return "ENTITLED";
  }
  return current;
}

export function prepareAction(
  status: TheaterWorkItemStatus,
): "advance" | "replay" | "reject" {
  if (status === "DENIED") {
    return "reject";
  }
  if (status === "FAILED") {
    return "reject";
  }
  if (PROPOSAL_LOCKED_STATUSES.includes(status) || status === "PREPARED") {
    return "replay";
  }
  return "advance";
}

export function requestSignatureAction(
  status: TheaterWorkItemStatus,
): "advance" | "replay" | "reject" {
  if (status === "PREPARED") {
    return "advance";
  }
  if (
    status === "AWAITING_SIGNATURE" ||
    status === "APPROVED" ||
    status === "EXECUTED" ||
    status === "VERIFIED"
  ) {
    return "replay";
  }
  return "reject";
}

export function decideAction(input: {
  status: TheaterWorkItemStatus;
  hasProposal: boolean;
  decision: "approved" | "denied";
}): "apply" | "replay" {
  if (!input.hasProposal) {
    throw new TheaterSessionError("NOT_PREPARED", "This filing is not prepared yet.", 409);
  }
  if (input.status === "APPROVED" && input.decision === "approved") {
    return "replay";
  }
  if (input.status === "DENIED" && input.decision === "denied") {
    return "replay";
  }
  if (input.status !== "AWAITING_SIGNATURE") {
    throw new TheaterSessionError(
      "STATE",
      `Signature is only accepted while awaiting signature. Current state is ${input.status}.`,
      409,
    );
  }
  return "apply";
}

export function executeMode(input: {
  status: TheaterWorkItemStatus;
  lastMutationId: string | null;
}): "mutate" | "replay" | "retry" {
  if ((input.status === "EXECUTED" || input.status === "VERIFIED") && input.lastMutationId) {
    return "replay";
  }
  if (input.status === "FAILED") {
    return input.lastMutationId ? "replay" : "retry";
  }
  return "mutate";
}

export function assertPrepareAllowed(status: TheaterWorkItemStatus): void {
  const action = prepareAction(status);
  if (action === "reject") {
    throw new TheaterSessionError(
      "STATE",
      status === "FAILED"
        ? "This filing failed after a signature. Retry execute_filing — do not re-prepare."
        : "This filing was denied and cannot be prepared again.",
      409,
    );
  }
}

export function assertRequestSignatureAllowed(status: TheaterWorkItemStatus): void {
  if (requestSignatureAction(status) === "reject") {
    throw new TheaterSessionError(
      "NOT_PREPARED",
      "Prepare the filing before requesting a signature.",
      409,
    );
  }
}

export function permissionErrorStatus(code: TheaterPermissionError["code"]): number {
  return code === "APPROVAL_REQUIRED" ? 403 : 409;
}
