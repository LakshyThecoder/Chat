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

export type RightsRegime = "EU261" | "UK261" | "DOT" | "FARE_REFUND" | "NONE";
export type AviationRegion = "EU" | "UK" | "US" | "OTHER";

export interface PassengerRightsInputs {
  bookingFound: boolean;
  origin: string | null;
  destination: string | null;
  cancelledByCarrier: boolean;
  ticketUnused: boolean;
  flightStatus: string | null;
  farePaid: string | null;
  currency: string;
  existingClaim: boolean;
  arrivalDelayMinutes: number | null;
  noticeDaysBeforeDeparture: number | null;
  extraordinaryCircumstances: boolean | null;
  operatingCarrierRegion: AviationRegion;
  departedFromRegion: AviationRegion;
  arrivedInRegion: AviationRegion;
}

export type RecoverableKind = "fare_refund" | "statutory_compensation" | "dot_refund";

export interface RecoverableLine {
  kind: RecoverableKind;
  regime: RightsRegime;
  decision: EligibilityDecision;
}

export interface PassengerRightsDecision {
  filing: EligibilityDecision;
  lines: RecoverableLine[];
  distanceKm: number | null;
  applicableRegimes: RightsRegime[];
}

export class EligibilityInputError extends Error {
  readonly code = "ELIGIBILITY_INPUT_INVALID";

  constructor(message: string) {
    super(message);
    this.name = "EligibilityInputError";
  }
}
