import "server-only";

import { createHash, randomBytes } from "crypto";
import { assertChamberSubmit, deriveChamberApproval } from "@/src/domain/chamber/permission";
import { CHAMBER_CATALOG, type ChamberSnapshot } from "@/src/domain/chamber/types";
import { normalizeSqlMoney } from "@/src/domain/money/cents";
import { evaluateFlightRefund } from "@/src/domain/eligibility/evaluate-flight-refund";
import { createAdminSupabaseClient } from "@/src/infrastructure/db/supabase/admin";
import { createFlyRightProvider } from "@/src/infrastructure/providers/flyright/service";
import type { FlyRightBooking } from "@/src/infrastructure/providers/flyright/types";

export const CHAMBER_COOKIE = "aegis_chamber";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export class ChamberSessionError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ChamberSessionError";
    this.code = code;
    this.status = status;
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function mintToken(): string {
  return randomBytes(32).toString("hex");
}

interface SessionRow {
  id: string;
  token_hash: string;
  booking_id: string;
  approved_at: string | null;
  denied_at: string | null;
  approved_amount: string | null;
  approved_currency: string | null;
  verification: ChamberSnapshot["verification"];
  expires_at: string;
}

async function loadSessionRow(token: string): Promise<SessionRow> {
  const client = createAdminSupabaseClient();
  const { data, error } = await client
    .from("chamber_sessions")
    .select("*")
    .eq("token_hash", hashToken(token))
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new ChamberSessionError("CHAMBER_NOT_FOUND", "No chamber session on this browser.", 404);
  }
  return {
    id: String(data.id),
    token_hash: String(data.token_hash),
    booking_id: String(data.booking_id),
    approved_at: data.approved_at ? String(data.approved_at) : null,
    denied_at: data.denied_at ? String(data.denied_at) : null,
    approved_amount: data.approved_amount != null ? normalizeSqlMoney(data.approved_amount) : null,
    approved_currency: data.approved_currency ? String(data.approved_currency) : null,
    verification: (data.verification as ChamberSnapshot["verification"]) ?? null,
    expires_at: String(data.expires_at),
  };
}

function compensationFor(booking: FlyRightBooking, existingClaim: boolean) {
  return evaluateFlightRefund({
    bookingFound: true,
    cancelledByCarrier: booking.cancelledByCarrier,
    ticketUnused: booking.ticketUnused,
    flightStatus: booking.flightStatus,
    farePaid: booking.farePaid,
    currency: booking.currency,
    existingClaim,
  });
}

async function snapshotFrom(session: SessionRow, viewed?: FlyRightBooking | null): Promise<ChamberSnapshot> {
  const flyright = createFlyRightProvider();
  const { data, error } = await createAdminSupabaseClient()
    .from("flyright_bookings")
    .select("*")
    .eq("id", session.booking_id)
    .maybeSingle();

  if (error || !data) {
    throw new ChamberSessionError("CHAMBER_TICKET_MISSING", "The chamber ticket is missing.", 500);
  }

  const ticket: FlyRightBooking = {
    id: String(data.id),
    locator: String(data.locator),
    lastName: String(data.last_name),
    passengerFirstName: String(data.passenger_first_name),
    flightNumber: String(data.flight_number),
    origin: String(data.origin),
    destination: String(data.destination),
    departureAt: String(data.departure_at),
    farePaid: normalizeSqlMoney(data.fare_paid),
    currency: String(data.currency),
    flightStatus: data.flight_status as FlyRightBooking["flightStatus"],
    cancelledByCarrier: Boolean(data.cancelled_by_carrier),
    ticketUnused: Boolean(data.ticket_unused),
  };

  const claim = await flyright.getClaimForBooking(ticket.locator);
  const compensation = compensationFor(ticket, Boolean(claim));

  return {
    locator: ticket.locator,
    lastName: ticket.lastName,
    passengerFirstName: ticket.passengerFirstName,
    flightNumber: ticket.flightNumber,
    origin: ticket.origin,
    destination: ticket.destination,
    departureAt: ticket.departureAt,
    farePaid: ticket.farePaid,
    currency: ticket.currency,
    flightStatus: ticket.flightStatus,
    cancelledByCarrier: ticket.cancelledByCarrier,
    ticketUnused: ticket.ticketUnused,
    approval: deriveChamberApproval({
      approvedAt: session.approved_at,
      deniedAt: session.denied_at,
    }),
    approvedAmount: session.approved_amount,
    compensation,
    booking: viewed ?? (session.approved_at || claim ? ticket : null),
    claim,
    verification: session.verification,
    expiresAt: session.expires_at,
    catalog: CHAMBER_CATALOG,
  };
}

export async function createChamberSession(): Promise<{ token: string; snapshot: ChamberSnapshot }> {
  const flyright = createFlyRightProvider();
  const ticket = await flyright.issueChamberTicket();
  const token = mintToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  const { error } = await createAdminSupabaseClient().from("chamber_sessions").insert({
    token_hash: hashToken(token),
    booking_id: ticket.id,
    expires_at: expiresAt,
  });

  if (error) {
    throw new Error(error.message);
  }

  const session = await loadSessionRow(token);
  const snapshot = await snapshotFrom(session, null);
  return { token, snapshot };
}

export async function getChamberSnapshot(token: string): Promise<ChamberSnapshot> {
  const session = await loadSessionRow(token);
  return snapshotFrom(session, null);
}

export async function decideChamber(params: {
  token: string;
  decision: "approved" | "denied";
}): Promise<ChamberSnapshot> {
  const session = await loadSessionRow(params.token);
  if (new Date() > new Date(session.expires_at)) {
    throw new ChamberSessionError("EXPIRED", "This chamber ticket has expired. Issue a fresh ticket.", 409);
  }

  const flyright = createFlyRightProvider();
  const snapshot = await snapshotFrom(session, null);

  if (params.decision === "denied") {
    const { error } = await createAdminSupabaseClient()
      .from("chamber_sessions")
      .update({
        denied_at: new Date().toISOString(),
        approved_at: null,
        approved_amount: null,
        approved_currency: null,
      })
      .eq("id", session.id);
    if (error) {
      throw new Error(error.message);
    }
    const deniedTicket = await flyright.getBooking(snapshot.locator, snapshot.lastName);
    return snapshotFrom(
      { ...session, denied_at: new Date().toISOString(), approved_at: null, approved_amount: null },
      deniedTicket,
    );
  }

  if (snapshot.compensation?.outcome !== "eligible" || !snapshot.compensation.amount) {
    throw new ChamberSessionError(
      "NOT_ELIGIBLE",
      snapshot.compensation?.reasons[0] ?? "This ticket is not eligible to sign.",
      409,
    );
  }

  const claim = await flyright.getClaimForBooking(snapshot.locator);
  if (claim) {
    throw new ChamberSessionError("ALREADY_FILED", "A claim is already on file for this ticket.", 409);
  }

  const { error } = await createAdminSupabaseClient()
    .from("chamber_sessions")
    .update({
      approved_at: new Date().toISOString(),
      denied_at: null,
      approved_amount: snapshot.compensation.amount,
      approved_currency: snapshot.compensation.currency,
    })
    .eq("id", session.id);

  if (error) {
    throw new Error(error.message);
  }

  const approvedTicket = await flyright.getBooking(snapshot.locator, snapshot.lastName);
  return snapshotFrom(
    {
      ...session,
      approved_at: new Date().toISOString(),
      denied_at: null,
      approved_amount: snapshot.compensation.amount,
    },
    approvedTicket,
  );
}

export async function executeChamberTool(params: {
  token: string;
  tool: string;
  input: Record<string, unknown>;
}): Promise<{ result: Record<string, unknown>; snapshot: ChamberSnapshot }> {
  const session = await loadSessionRow(params.token);
  const flyright = createFlyRightProvider();
  const held = await snapshotFrom(session, null);
  const input = params.input;

  switch (params.tool) {
    case "get_chamber": {
      return { result: { chamber: held }, snapshot: held };
    }
    case "get_booking": {
      const locator = String(input.locator ?? "");
      const lastName = String(input.lastName ?? "");
      const booking = await flyright.getBooking(locator, lastName);
      const viewed = await snapshotFrom(session, booking);
      return { result: { booking }, snapshot: viewed };
    }
    case "get_flight_status": {
      const locator = String(input.locator ?? "");
      const lastName = String(input.lastName ?? "");
      const status = await flyright.getFlightStatus(locator, lastName);
      const booking = await flyright.getBooking(locator, lastName);
      return { result: { status }, snapshot: await snapshotFrom(session, booking) };
    }
    case "get_policy": {
      const policy = await flyright.getPolicy();
      return { result: { policy }, snapshot: held };
    }
    case "calculate_compensation": {
      const locator = String(input.locator ?? "");
      const lastName = String(input.lastName ?? "");
      const compensation = await flyright.calculateCompensation(locator, lastName);
      const booking = await flyright.getBooking(locator, lastName);
      return { result: { compensation }, snapshot: await snapshotFrom(session, booking) };
    }
    case "get_claim_status": {
      if (typeof input.claimId === "string" && input.claimId) {
        const claim = await flyright.getClaimStatus(input.claimId);
        return { result: { claim }, snapshot: held };
      }
      const locator = String(input.locator ?? held.locator);
      const claim = await flyright.getClaimForBooking(locator);
      return { result: { claim }, snapshot: held };
    }
    case "submit_claim": {
      const requestedLocator = String(input.locator ?? held.locator);
      const requestedLastName = String(input.lastName ?? held.lastName);
      const requestedAmount = String(input.amount ?? held.approvedAmount ?? "");

      assertChamberSubmit({
        now: new Date(),
        expiresAt: session.expires_at,
        approvedAt: session.approved_at,
        deniedAt: session.denied_at,
        sessionLocator: held.locator,
        sessionLastName: held.lastName,
        requestedLocator,
        requestedLastName,
        approvedAmount: session.approved_amount,
        requestedAmount,
      });

      const submitted = await flyright.submitClaim({
        locator: held.locator,
        lastName: held.lastName,
        amount: session.approved_amount as string,
        currency: session.approved_currency ?? held.currency,
        idempotencyKey: `chamber:${session.id}:submit_claim`,
      });
      const observed = await flyright.getClaimStatus(submitted.id);
      const matched =
        observed.id === submitted.id &&
        observed.amount === session.approved_amount &&
        observed.locator === held.locator;
      const verification = {
        expected: {
          claimId: submitted.id,
          amount: session.approved_amount,
          locator: held.locator,
        },
        observed: { ...observed },
        matched,
      };

      const { error } = await createAdminSupabaseClient()
        .from("chamber_sessions")
        .update({ verification })
        .eq("id", session.id);
      if (error) {
        throw new Error(error.message);
      }

      const next = await snapshotFrom({ ...session, verification }, await flyright.getBooking(held.locator, held.lastName));
      return { result: { claim: observed, verification }, snapshot: next };
    }
    default:
      throw new ChamberSessionError("UNKNOWN_TOOL", `Unknown chamber tool: ${params.tool}`, 400);
  }
}

export function chamberCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  };
}
