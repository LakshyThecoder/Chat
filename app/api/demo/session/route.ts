import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  CHAMBER_COOKIE,
  ChamberSessionError,
  chamberCookieOptions,
  createChamberSession,
  getChamberSnapshot,
} from "@/src/application/commands/chamber-session";
import {
  generateCorrelationId,
  getCorrelationIdFromHeaders,
} from "@/src/infrastructure/observability/correlation";
import { createErrorResponse, withCorrelationHeaders } from "@/src/lib/api/error-response";

export async function GET(request: Request) {
  const correlationId =
    getCorrelationIdFromHeaders(new Headers(request.headers)) ?? generateCorrelationId();
  const jar = await cookies();
  const token = jar.get(CHAMBER_COOKIE)?.value;
  if (!token) {
    return createErrorResponse("CHAMBER_NOT_FOUND", "No chamber session on this browser.", correlationId, 404);
  }

  try {
    const snapshot = await getChamberSnapshot(token);
    return withCorrelationHeaders(NextResponse.json({ chamber: snapshot }), correlationId);
  } catch (error) {
    if (error instanceof ChamberSessionError) {
      return createErrorResponse(error.code, error.message, correlationId, error.status);
    }
    return createErrorResponse("CHAMBER_UNAVAILABLE", "Could not load the chamber.", correlationId, 503, true);
  }
}

export async function POST(request: Request) {
  const correlationId =
    getCorrelationIdFromHeaders(new Headers(request.headers)) ?? generateCorrelationId();

  try {
    const { token, snapshot } = await createChamberSession();
    const response = NextResponse.json({ chamber: snapshot });
    response.cookies.set(CHAMBER_COOKIE, token, chamberCookieOptions());
    return withCorrelationHeaders(response, correlationId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not open a chamber.";
    return createErrorResponse("CHAMBER_UNAVAILABLE", message, correlationId, 503, true);
  }
}
