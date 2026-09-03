export type StreamlySubscriptionStatus = "active" | "cancelled";
export type StreamlyRefundStatus =
  | "OPEN"
  | "UNDER_REVIEW"
  | "NEEDS_INFORMATION"
  | "ACCEPTED"
  | "REJECTED";

export interface StreamlySubscription {
  id: string;
  subscriptionId: string;
  accountEmail: string;
  planName: string;
  monthlyPrice: string;
  currency: string;
  status: StreamlySubscriptionStatus;
  cancelledAt: string | null;
  lastChargedAt: string;
  lastChargeAmount: string;
}

export interface StreamlyRefund {
  id: string;
  subscriptionUuid: string;
  subscriptionId: string;
  amount: string;
  currency: string;
  status: StreamlyRefundStatus;
  idempotencyKey: string;
  aegisCaseId: string | null;
  createdAt: string;
}

export class StreamlyNotFoundError extends Error {
  readonly code = "STREAMLY_NOT_FOUND";

  constructor() {
    super("No Streamly subscription matched that account email and subscription id.");
    this.name = "StreamlyNotFoundError";
  }
}

export class StreamlyConflictError extends Error {
  readonly code = "STREAMLY_CONFLICT";

  constructor(message: string) {
    super(message);
    this.name = "StreamlyConflictError";
  }
}
