export type FlyRightFlightStatus = "SCHEDULED" | "ON_TIME" | "CANCELLED" | "FLOWN";
export type FlyRightClaimStatus =
  | "OPEN"
  | "UNDER_REVIEW"
  | "NEEDS_INFORMATION"
  | "ACCEPTED"
  | "REJECTED";

export interface FlyRightBooking {
  id: string;
  locator: string;
  lastName: string;
  passengerFirstName: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureAt: string;
  farePaid: string;
  currency: string;
  flightStatus: FlyRightFlightStatus;
  cancelledByCarrier: boolean;
  ticketUnused: boolean;
}

export interface FlyRightClaim {
  id: string;
  bookingId: string;
  locator: string;
  lastName: string;
  amount: string;
  currency: string;
  status: FlyRightClaimStatus;
  idempotencyKey: string;
  aegisCaseId: string | null;
  createdAt: string;
}

export class FlyRightNotFoundError extends Error {
  readonly code = "FLYRIGHT_NOT_FOUND";

  constructor() {
    super("No booking matched that locator and last name.");
    this.name = "FlyRightNotFoundError";
  }
}

export class FlyRightConflictError extends Error {
  readonly code = "FLYRIGHT_CONFLICT";

  constructor(message: string) {
    super(message);
    this.name = "FlyRightConflictError";
  }
}
