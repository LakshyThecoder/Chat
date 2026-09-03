import type { ChamberApproval } from "@/src/domain/chamber/permission";
import type { EligibilityDecision } from "@/src/domain/eligibility/types";
import type { FlyRightBooking, FlyRightClaim } from "@/src/infrastructure/providers/flyright/types";

export interface ChamberVerification {
  expected: Record<string, unknown>;
  observed: Record<string, unknown>;
  matched: boolean;
}

export interface ChamberSnapshot {
  locator: string;
  lastName: string;
  passengerFirstName: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureAt: string;
  farePaid: string;
  currency: string;
  flightStatus: string;
  cancelledByCarrier: boolean;
  ticketUnused: boolean;
  approval: ChamberApproval;
  approvedAmount: string | null;
  compensation: EligibilityDecision | null;
  booking: FlyRightBooking | null;
  claim: FlyRightClaim | null;
  verification: ChamberVerification | null;
  expiresAt: string;
  catalog: {
    ineligible: { locator: string; lastName: string };
    alreadyClaimed: { locator: string; lastName: string };
  };
}

export const CHAMBER_CATALOG = {
  ineligible: { locator: "FR2201", lastName: "KLEIN" },
  alreadyClaimed: { locator: "FR0999", lastName: "BERG" },
} as const;

export const CHAMBER_TEMPLATE = {
  locator: "FR1842",
  lastName: "MOREAU",
} as const;
