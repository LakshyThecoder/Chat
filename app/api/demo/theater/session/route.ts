import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  THEATER_COOKIE,
  TheaterSessionError,
  createTheaterSession,
  getTheaterSnapshot,
  theaterCookieOptions,
} from "@/src/application/commands/theater-session";
import {
  generateCorrelationId,
  getCorrelationIdFromHeaders,
} from "@/src/infrastructure/observability/correlation";
import { createErrorResponse, withCorrelationHeaders } from "@/src/lib/api/error-response";

export async function GET(request: Request) {
  const correlationId =
    getCorrelationIdFromHeaders(new Headers(request.headers)) ?? generateCorrelationId();
  const jar = await cookies();
  const token = jar.get(THEATER_COOKIE)?.value;
  if (!token) {
    return createErrorResponse("THEATER_NOT_FOUND", "No theater session on this browser.", correlationId, 404);
  }

  try {
    const snapshot = await getTheaterSnapshot(token);
    return withCorrelationHeaders(NextResponse.json({ theater: snapshot }), correlationId);
  } catch (error) {
    if (error instanceof TheaterSessionError) {
      return createErrorResponse(error.code, error.message, correlationId, error.status);
    }
    return createErrorResponse("THEATER_UNAVAILABLE", "Could not load the theater.", correlationId, 503, true);
  }
}

export async function POST(request: Request) {
  const correlationId =
    getCorrelationIdFromHeaders(new Headers(request.headers)) ?? generateCorrelationId();
  const jar = await cookies();
  const previousToken = jar.get(THEATER_COOKIE)?.value ?? null;

  try {
    const { token, snapshot } = await createTheaterSession({ previousToken });
    const response = NextResponse.json({ theater: snapshot });
    response.cookies.set(THEATER_COOKIE, token, theaterCookieOptions());
    return withCorrelationHeaders(response, correlationId);
  } catch (error) {
    if (error instanceof TheaterSessionError) {
      return createErrorResponse(error.code, error.message, correlationId, error.status);
    }
    const message = error instanceof Error ? error.message : "Could not open a theater session.";
    return createErrorResponse("THEATER_UNAVAILABLE", message, correlationId, 503, true);
  }
}
