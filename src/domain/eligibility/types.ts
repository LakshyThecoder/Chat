export type EligibilityOutcome = "eligible" | "ineligible" | "uncertain";

export interface FlightRefundInputs {
  bookingFound: boolean;
  cancelledByCarrier: boolean;
  ticketUnused: boolean;
  flightStatus: string | null;
  farePaid: string | null;
  currency: string;
  existingClaim: boolean;
}

export interface SubscriptionRefundInputs {
  subscriptionFound: boolean;
  status: "active" | "cancelled" | null;
  cancelledAt: string | null;
  lastChargedAt: string | null;
  lastChargeAmount: string | null;
  currency: string;
  existingRefund: boolean;
}

export interface WarrantyClaimInputs {
  orderFound: boolean;
  purchasedAt: string | null;
  warrantyMonths: number | null;
  asOf?: string;
  existingClaim: boolean;
  returnOpened: boolean;
  purchasePrice: string | null;
  currency: string;
}

export interface EligibilityDecision {
  outcome: EligibilityOutcome;
  amount: string | null;
  currency: string;
  ruleIds: string[];
  reasons: string[];
}

export class EligibilityInputError extends Error {
  readonly code = "ELIGIBILITY_INPUT_INVALID";

  constructor(message: string) {
    super(message);
    this.name = "EligibilityInputError";
  }
}
