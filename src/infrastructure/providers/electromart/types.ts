export type ElectroMartClaimStatus =
  | "OPEN"
  | "UNDER_REVIEW"
  | "NEEDS_INFORMATION"
  | "ACCEPTED"
  | "REJECTED";

export interface ElectroMartOrder {
  id: string;
  orderId: string;
  lastName: string;
  productName: string;
  purchasedAt: string;
  warrantyMonths: number;
  purchasePrice: string;
  currency: string;
  returnOpened: boolean;
}

export interface ElectroMartClaim {
  id: string;
  orderUuid: string;
  orderId: string;
  lastName: string;
  amount: string;
  currency: string;
  status: ElectroMartClaimStatus;
  idempotencyKey: string;
  aegisCaseId: string | null;
  createdAt: string;
}

export class ElectroMartNotFoundError extends Error {
  readonly code = "ELECTROMART_NOT_FOUND";

  constructor() {
    super("No ElectroMart order matched that order id and last name.");
    this.name = "ElectroMartNotFoundError";
  }
}

export class ElectroMartConflictError extends Error {
  readonly code = "ELECTROMART_CONFLICT";

  constructor(message: string) {
    super(message);
    this.name = "ElectroMartConflictError";
  }
}
