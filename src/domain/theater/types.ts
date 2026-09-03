import type { EligibilityDecision } from "@/src/domain/eligibility/types";

export type TheaterProviderId = "flyright" | "streamly" | "electromart";

export type TheaterWorkItemStatus =
  | "UNINSPECTED"
  | "INSPECTED"
  | "ENTITLED"
  | "PREPARED"
  | "AWAITING_SIGNATURE"
  | "APPROVED"
  | "DENIED"
  | "EXECUTED"
  | "VERIFIED"
  | "FAILED";

export type TheaterWorkItemIdentity =
  | {
      providerId: "flyright";
      locator: string;
      lastName: string;
    }
  | {
      providerId: "streamly";
      subscriptionId: string;
      accountEmail: string;
    }
  | {
      providerId: "electromart";
      orderId: string;
      lastName: string;
    };

export interface TheaterProposal {
  toolName: string;
  payload: Record<string, unknown>;
  amount: string | null;
  currency: string;
  idempotencyKey: string;
  expectedVerification: Record<string, unknown>;
}

export interface TheaterVerification {
  expected: Record<string, unknown>;
  observed: Record<string, unknown>;
  matched: boolean;
}

export interface TheaterWorkItemSnapshot {
  id: string;
  providerId: TheaterProviderId;
  title: string;
  identity: TheaterWorkItemIdentity;
  status: TheaterWorkItemStatus;
  counter: Record<string, unknown> | null;
  entitlement: EligibilityDecision | null;
  proposal: TheaterProposal | null;
  approval: {
    state: "unsigned" | "approved" | "denied";
    approvedAmount: string | null;
    approvedCurrency: string | null;
    approvedAt: string | null;
    deniedAt: string | null;
  };
  verification: TheaterVerification | null;
}

export interface TheaterSnapshot {
  sessionId: string;
  expiresAt: string;
  items: TheaterWorkItemSnapshot[];
}

