import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  THEATER_COOKIE,
  TheaterSessionError,
  decideTheaterWorkItem,
} from "@/src/application/commands/theater-session";
import {
  generateCorrelationId,
  getCorrelationIdFromHeaders,
} from "@/src/infrastructure/observability/correlation";
import { createErrorResponse, withCorrelationHeaders } from "@/src/lib/api/error-response";

const bodySchema = z.object({
  workItemId: z.string().uuid(),
  decision: z.enum(["approved", "denied"]),
});

export async function POST(request: Request) {
  const correlationId =
    getCorrelationIdFromHeaders(new Headers(request.headers)) ?? generateCorrelationId();
  const jar = await cookies();
  const token = jar.get(THEATER_COOKIE)?.value;
  if (!token) {
    return createErrorResponse("THEATER_NOT_FOUND", "No theater session on this browser.", correlationId, 404);
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return createErrorResponse("INVALID_JSON", "Request body must be valid JSON.", correlationId, 400);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return createErrorResponse("INVALID_ARGUMENT", "workItemId and decision are required.", correlationId, 400);
  }

  try {
    const snapshot = await decideTheaterWorkItem({
      token,
      workItemId: parsed.data.workItemId,
      decision: parsed.data.decision,
    });
    return withCorrelationHeaders(NextResponse.json({ theater: snapshot }), correlationId);
  } catch (error) {
    if (error instanceof TheaterSessionError) {
      return createErrorResponse(error.code, error.message, correlationId, error.status);
    }
    const message = error instanceof Error ? error.message : "Could not record the signature.";
    return createErrorResponse("THEATER_UNAVAILABLE", message, correlationId, 503, true);
  }
}

