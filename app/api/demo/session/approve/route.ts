import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  CHAMBER_COOKIE,
  ChamberSessionError,
  decideChamber,
} from "@/src/application/commands/chamber-session";
import {
  generateCorrelationId,
  getCorrelationIdFromHeaders,
} from "@/src/infrastructure/observability/correlation";
import { createErrorResponse, withCorrelationHeaders } from "@/src/lib/api/error-response";

const bodySchema = z.object({
  decision: z.enum(["approved", "denied"]),
});

export async function POST(request: Request) {
  const correlationId =
    getCorrelationIdFromHeaders(new Headers(request.headers)) ?? generateCorrelationId();
  const jar = await cookies();
  const token = jar.get(CHAMBER_COOKIE)?.value;
  if (!token) {
    return createErrorResponse("CHAMBER_NOT_FOUND", "No chamber session on this browser.", correlationId, 404);
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return createErrorResponse("INVALID_JSON", "Request body must be valid JSON.", correlationId, 400);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return createErrorResponse("INVALID_ARGUMENT", "decision must be approved or denied.", correlationId, 400);
  }

  try {
    const snapshot = await decideChamber({ token, decision: parsed.data.decision });
    return withCorrelationHeaders(NextResponse.json({ chamber: snapshot }), correlationId);
  } catch (error) {
    if (error instanceof ChamberSessionError) {
      return createErrorResponse(error.code, error.message, correlationId, error.status);
    }
    const message = error instanceof Error ? error.message : "Could not record the signature.";
    return createErrorResponse("CHAMBER_UNAVAILABLE", message, correlationId, 503, true);
  }
}
