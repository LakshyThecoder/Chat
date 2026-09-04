import {
  evaluatePassengerRights,
  inferPassengerRightsInputs,
} from "@/src/domain/eligibility/evaluate-passenger-rights";
import type { PassengerRightsDecision } from "@/src/domain/eligibility/types";
import { AIRLINE_INBOX } from "@/src/domain/flight-desk/inbox-catalog";
import type { TheaterWorkItemSnapshot } from "@/src/domain/theater/types";

export interface ObservedBooking {
  locator: string;
  lastName: string;
  flightNumber: string | null;
  origin: string | null;
  destination: string | null;
  departureAt: string | null;
  farePaid: string | null;
  currency: string;
  flightStatus: string | null;
  cancelledByCarrier: boolean;
  ticketUnused: boolean;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export function bookingFromCounter(counter: Record<string, unknown> | null): ObservedBooking | null {
  const root = asRecord(counter);
  if (!root) return null;
  const booking = asRecord(root.booking) ?? root;
  const locator = typeof booking.locator === "string" ? booking.locator : null;
  const lastName = typeof booking.lastName === "string" ? booking.lastName : null;
  if (!locator || !lastName) return null;
  return {
    locator,
    lastName,
    flightNumber: typeof booking.flightNumber === "string" ? booking.flightNumber : null,
    origin: typeof booking.origin === "string" ? booking.origin : null,
    destination: typeof booking.destination === "string" ? booking.destination : null,
    departureAt: typeof booking.departureAt === "string" ? booking.departureAt : null,
    farePaid: typeof booking.farePaid === "string" ? booking.farePaid : null,
    currency: typeof booking.currency === "string" ? booking.currency : "EUR",
    flightStatus: typeof booking.flightStatus === "string" ? booking.flightStatus : null,
    cancelledByCarrier: Boolean(booking.cancelledByCarrier),
    ticketUnused: booking.ticketUnused !== false,
  };
}

export function claimExists(counter: Record<string, unknown> | null): boolean {
  const root = asRecord(counter);
  if (!root) return false;
  return Boolean(root.claim);
}

export function isFlyRightItem(item: TheaterWorkItemSnapshot): boolean {
  return item.providerId === "flyright" && item.identity.providerId === "flyright";
}

export function rightsFromWorkItem(item: TheaterWorkItemSnapshot): PassengerRightsDecision {
  const observed = bookingFromCounter(item.counter);
  const identity = item.identity.providerId === "flyright" ? item.identity : null;
  const mail = AIRLINE_INBOX.find(
    (thread) =>
      identity &&
      thread.locator === identity.locator &&
      thread.lastName === identity.lastName &&
      !thread.watchOnly,
  );

  return evaluatePassengerRights(
    inferPassengerRightsInputs({
      bookingFound: Boolean(observed) || Boolean(identity),
      origin: observed?.origin ?? mail?.origin ?? null,
      destination: observed?.destination ?? mail?.destination ?? null,
      cancelledByCarrier: observed?.cancelledByCarrier ?? item.catalogBlocked === false,
      ticketUnused: observed?.ticketUnused ?? true,
      flightStatus: observed?.flightStatus ?? (item.catalogBlocked ? "CANCELLED" : "CANCELLED"),
      farePaid: observed?.farePaid ?? item.entitlement?.amount ?? null,
      currency: observed?.currency ?? item.entitlement?.currency ?? "EUR",
      existingClaim: item.catalogBlocked || claimExists(item.counter),
    }),
  );
}
