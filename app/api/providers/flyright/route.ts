import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createFlyRightProvider,
} from "@/src/infrastructure/providers/flyright/service";
import {
  FlyRightConflictError,
  FlyRightNotFoundError,
} from "@/src/infrastructure/providers/flyright/types";
import {
  generateCorrelationId,
  getCorrelationIdFromHeaders,
} from "@/src/infrastructure/observability/correlation";
import { createErrorResponse, withCorrelationHeaders } from "@/src/lib/api/error-response";

const lookupSchema = z.object({
  locator: z.string().min(3).max(12),
  lastName: z.string().min(1).max(80),
});

function handleProviderError(error: unknown, correlationId: string) {
  if (error instanceof FlyRightNotFoundError) {
    return createErrorResponse(error.code, error.message, correlationId, 404);
  }
  if (error instanceof FlyRightConflictError) {
    return createErrorResponse(error.code, error.message, correlationId, 409);
  }
  return createErrorResponse(
    "FLYRIGHT_UNAVAILABLE",
    "FlyRight could not complete the request.",
    correlationId,
    503,
    true,
  );
}

export async function POST(request: NextRequest) {
  const correlationId =
    getCorrelationIdFromHeaders(request.headers) ?? generateCorrelationId();
  const tool = request.nextUrl.searchParams.get("tool");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse("INVALID_JSON", "Request body must be valid JSON.", correlationId, 400);
  }

  const flyright = createFlyRightProvider();

  try {
    switch (tool) {
      case "get_booking": {
        const parsed = lookupSchema.safeParse(body);
        if (!parsed.success) {
          return createErrorResponse("INVALID_ARGUMENT", "locator and lastName are required.", correlationId, 400);
        }
        const booking = await flyright.getBooking(parsed.data.locator, parsed.data.lastName);
        return withCorrelationHeaders(NextResponse.json({ booking }), correlationId);
      }
      case "get_flight_status": {
        const parsed = lookupSchema.safeParse(body);
        if (!parsed.success) {
          return createErrorResponse("INVALID_ARGUMENT", "locator and lastName are required.", correlationId, 400);
        }
        const status = await flyright.getFlightStatus(parsed.data.locator, parsed.data.lastName);
        return withCorrelationHeaders(NextResponse.json({ status }), correlationId);
      }
      case "get_policy": {
        const policy = await flyright.getPolicy();
        return withCorrelationHeaders(NextResponse.json({ policy }), correlationId);
      }
      case "calculate_compensation": {
        const parsed = lookupSchema.safeParse(body);
        if (!parsed.success) {
          return createErrorResponse("INVALID_ARGUMENT", "locator and lastName are required.", correlationId, 400);
        }
        const compensation = await flyright.calculateCompensation(
          parsed.data.locator,
          parsed.data.lastName,
        );
        return withCorrelationHeaders(NextResponse.json({ compensation }), correlationId);
      }
      case "get_claim_status": {
        const parsed = z
          .object({ claimId: z.string().uuid().optional(), locator: z.string().min(3).optional() })
          .safeParse(body);
        if (!parsed.success) {
          return createErrorResponse("INVALID_ARGUMENT", "claimId or locator is required.", correlationId, 400);
        }
        if (parsed.data.claimId) {
          const claim = await flyright.getClaimStatus(parsed.data.claimId);
          return withCorrelationHeaders(NextResponse.json({ claim }), correlationId);
        }
        if (parsed.data.locator) {
          const claim = await flyright.getClaimForBooking(parsed.data.locator);
          return withCorrelationHeaders(NextResponse.json({ claim }), correlationId);
        }
        return createErrorResponse("INVALID_ARGUMENT", "claimId or locator is required.", correlationId, 400);
      }
      case "submit_claim": {
        const parsed = lookupSchema
          .extend({
            amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
            currency: z.string().length(3).default("EUR"),
            idempotencyKey: z.string().min(8).max(180),
          })
          .safeParse(body);
        if (!parsed.success) {
          return createErrorResponse(
            "INVALID_ARGUMENT",
            "locator, lastName, amount and idempotencyKey are required.",
            correlationId,
            400,
          );
        }
        const claim = await flyright.submitClaim(parsed.data);
        return withCorrelationHeaders(NextResponse.json({ claim }), correlationId);
      }
      case "request_follow_up": {
        const parsed = z.object({ claimId: z.string().uuid() }).safeParse(body);
        if (!parsed.success) {
          return createErrorResponse("INVALID_ARGUMENT", "claimId is required.", correlationId, 400);
        }
        const claim = await flyright.requestFollowUp(parsed.data.claimId);
        return withCorrelationHeaders(NextResponse.json({ claim }), correlationId);
      }
      default:
        return createErrorResponse("UNKNOWN_TOOL", "Unknown FlyRight tool.", correlationId, 400);
    }
  } catch (error) {
    return handleProviderError(error, correlationId);
  }
}
