import "server-only";

import { createAdminSupabaseClient } from "@/src/infrastructure/db/supabase/admin";
import { evaluateFlightRefund } from "@/src/domain/eligibility/evaluate-flight-refund";
import { normalizeSqlMoney } from "@/src/domain/money/cents";
import { generateChamberLocator } from "@/src/domain/chamber/locator";
import { CHAMBER_TEMPLATE } from "@/src/domain/chamber/types";
import {
  FlyRightConflictError,
  FlyRightNotFoundError,
  type FlyRightBooking,
  type FlyRightClaim,
  type FlyRightClaimStatus,
  type FlyRightFlightStatus,
} from "@/src/infrastructure/providers/flyright/types";

function normalizeLocator(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeLastName(value: string): string {
  return value.trim().toUpperCase();
}

function mapBooking(row: Record<string, unknown>): FlyRightBooking {
  return {
    id: String(row.id),
    locator: String(row.locator),
    lastName: String(row.last_name),
    passengerFirstName: String(row.passenger_first_name),
    flightNumber: String(row.flight_number),
    origin: String(row.origin),
    destination: String(row.destination),
    departureAt: String(row.departure_at),
    farePaid: normalizeSqlMoney(row.fare_paid),
    currency: String(row.currency),
    flightStatus: row.flight_status as FlyRightFlightStatus,
    cancelledByCarrier: Boolean(row.cancelled_by_carrier),
    ticketUnused: Boolean(row.ticket_unused),
  };
}

function mapClaim(row: Record<string, unknown>): FlyRightClaim {
  return {
    id: String(row.id),
    bookingId: String(row.booking_id),
    locator: String(row.locator),
    lastName: String(row.last_name),
    amount: normalizeSqlMoney(row.amount),
    currency: String(row.currency),
    status: row.status as FlyRightClaimStatus,
    idempotencyKey: String(row.idempotency_key),
    aegisCaseId: row.aegis_case_id ? String(row.aegis_case_id) : null,
    createdAt: String(row.created_at),
  };
}

export class FlyRightProvider {
  constructor(private readonly client = createAdminSupabaseClient()) {}

  async getBooking(locator: string, lastName: string): Promise<FlyRightBooking> {
    const { data, error } = await this.client
      .from("flyright_bookings")
      .select("*")
      .eq("locator", normalizeLocator(locator))
      .eq("last_name", normalizeLastName(lastName))
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      throw new FlyRightNotFoundError();
    }
    return mapBooking(data);
  }

  async getFlightStatus(locator: string, lastName: string) {
    const booking = await this.getBooking(locator, lastName);
    return {
      locator: booking.locator,
      flightNumber: booking.flightNumber,
      flightStatus: booking.flightStatus,
      cancelledByCarrier: booking.cancelledByCarrier,
      departureAt: booking.departureAt,
    };
  }

  async getPolicy() {
    const { data, error } = await this.client
      .from("provider_policies")
      .select("*")
      .eq("provider", "flyright")
      .eq("policy_key", "carrier_cancel_unused_fare")
      .eq("version", "2026.09")
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      throw new Error("FlyRight policy is not published.");
    }

    return {
      id: String(data.id),
      provider: String(data.provider),
      policyKey: String(data.policy_key),
      version: String(data.version),
      title: String(data.title),
      body: String(data.body),
    };
  }

  async getClaimForBooking(locator: string): Promise<FlyRightClaim | null> {
    const { data, error } = await this.client
      .from("flyright_claims")
      .select("*")
      .eq("locator", normalizeLocator(locator))
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    return data ? mapClaim(data) : null;
  }

  async calculateCompensation(locator: string, lastName: string) {
    const booking = await this.getBooking(locator, lastName);
    const existing = await this.getClaimForBooking(booking.locator);
    const decision = evaluateFlightRefund({
      bookingFound: true,
      cancelledByCarrier: booking.cancelledByCarrier,
      ticketUnused: booking.ticketUnused,
      flightStatus: booking.flightStatus,
      farePaid: booking.farePaid,
      currency: booking.currency,
      existingClaim: Boolean(existing),
    });

    return {
      locator: booking.locator,
      outcome: decision.outcome,
      amount: decision.amount,
      currency: decision.currency,
      reasons: decision.reasons,
      ruleIds: decision.ruleIds,
    };
  }

  async submitClaim(params: {
    locator: string;
    lastName: string;
    amount: string;
    currency: string;
    idempotencyKey: string;
    aegisCaseId?: string;
  }): Promise<FlyRightClaim> {
    const existingByKey = await this.client
      .from("flyright_claims")
      .select("*")
      .eq("idempotency_key", params.idempotencyKey)
      .maybeSingle();

    if (existingByKey.error) {
      throw new Error(existingByKey.error.message);
    }
    if (existingByKey.data) {
      return mapClaim(existingByKey.data);
    }

    const booking = await this.getBooking(params.locator, params.lastName);
    const compensation = await this.calculateCompensation(params.locator, params.lastName);

    if (compensation.outcome !== "eligible" || !compensation.amount) {
      throw new FlyRightConflictError(
        compensation.reasons[0] ?? "Booking is not eligible for a refund claim.",
      );
    }

    if (compensation.amount !== params.amount || compensation.currency !== params.currency) {
      throw new FlyRightConflictError(
        "Submitted amount does not match the carrier calculation.",
      );
    }

    const { data, error } = await this.client
      .from("flyright_claims")
      .insert({
        booking_id: booking.id,
        locator: booking.locator,
        last_name: booking.lastName,
        amount: params.amount,
        currency: params.currency,
        status: "OPEN",
        idempotency_key: params.idempotencyKey,
        aegis_case_id: params.aegisCaseId ?? null,
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        const replayByKey = await this.client
          .from("flyright_claims")
          .select("*")
          .eq("idempotency_key", params.idempotencyKey)
          .maybeSingle();
        if (replayByKey.data) {
          return mapClaim(replayByKey.data);
        }
        throw new FlyRightConflictError("A claim already exists for this booking.");
      }
      throw new Error(error.message);
    }

    return mapClaim(data);
  }

  async getClaimStatus(claimId: string): Promise<FlyRightClaim> {
    const { data, error } = await this.client
      .from("flyright_claims")
      .select("*")
      .eq("id", claimId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      throw new FlyRightNotFoundError();
    }
    return mapClaim(data);
  }

  async issueChamberTicket(): Promise<FlyRightBooking> {
    const template = await this.getBooking(CHAMBER_TEMPLATE.locator, CHAMBER_TEMPLATE.lastName);

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const locator = generateChamberLocator();
      const { data, error } = await this.client
        .from("flyright_bookings")
        .insert({
          locator,
          last_name: template.lastName,
          passenger_first_name: template.passengerFirstName,
          flight_number: template.flightNumber,
          origin: template.origin,
          destination: template.destination,
          departure_at: template.departureAt,
          fare_paid: template.farePaid,
          currency: template.currency,
          flight_status: template.flightStatus,
          cancelled_by_carrier: template.cancelledByCarrier,
          ticket_unused: template.ticketUnused,
          issued_by: "chamber",
        })
        .select("*")
        .single();

      if (!error && data) {
        return mapBooking(data);
      }
      if (error?.code === "23505") {
        continue;
      }
      throw new Error(error?.message ?? "FlyRight could not issue a chamber ticket.");
    }

    throw new Error("FlyRight could not issue a unique chamber ticket.");
  }

  async requestFollowUp(claimId: string) {
    const claim = await this.getClaimStatus(claimId);
    if (claim.status === "NEEDS_INFORMATION") {
      const { data, error } = await this.client
        .from("flyright_claims")
        .update({ status: "UNDER_REVIEW" })
        .eq("id", claimId)
        .select("*")
        .single();
      if (error || !data) {
        throw new Error(error?.message ?? "Follow-up failed");
      }
      return mapClaim(data);
    }
    return claim;
  }
}

export function createFlyRightProvider() {
  return new FlyRightProvider();
}
