import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createElectroMartProvider } from "@/src/infrastructure/providers/electromart/service";
import {
  ElectroMartConflictError,
  ElectroMartNotFoundError,
} from "@/src/infrastructure/providers/electromart/types";
import {
  generateCorrelationId,
  getCorrelationIdFromHeaders,
} from "@/src/infrastructure/observability/correlation";
import { createErrorResponse, withCorrelationHeaders } from "@/src/lib/api/error-response";

const lookupSchema = z.object({
  orderId: z.string().min(3).max(32),
  lastName: z.string().min(1).max(80),
});

function handleProviderError(error: unknown, correlationId: string) {
  if (error instanceof ElectroMartNotFoundError) {
    return createErrorResponse(error.code, error.message, correlationId, 404);
  }
  if (error instanceof ElectroMartConflictError) {
    return createErrorResponse(error.code, error.message, correlationId, 409);
  }
  return createErrorResponse(
    "ELECTROMART_UNAVAILABLE",
    "ElectroMart could not complete the request.",
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

  const electromart = createElectroMartProvider();

  try {
    switch (tool) {
      case "get_order": {
        const parsed = lookupSchema.safeParse(body);
        if (!parsed.success) {
          return createErrorResponse(
            "INVALID_ARGUMENT",
            "orderId and lastName are required.",
            correlationId,
            400,
          );
        }
        const order = await electromart.getOrder(parsed.data.orderId, parsed.data.lastName);
        return withCorrelationHeaders(NextResponse.json({ order }), correlationId);
      }
      case "get_return_policy": {
        const policy = await electromart.getReturnPolicy();
        return withCorrelationHeaders(NextResponse.json({ policy }), correlationId);
      }
      case "get_warranty": {
        const parsed = lookupSchema.safeParse(body);
        if (!parsed.success) {
          return createErrorResponse(
            "INVALID_ARGUMENT",
            "orderId and lastName are required.",
            correlationId,
            400,
          );
        }
        const warranty = await electromart.getWarranty(parsed.data.orderId, parsed.data.lastName);
        return withCorrelationHeaders(NextResponse.json({ warranty }), correlationId);
      }
      case "get_case_status": {
        const parsed = z
          .object({
            claimId: z.string().uuid().optional(),
            orderId: z.string().min(3).optional(),
          })
          .safeParse(body);
        if (!parsed.success) {
          return createErrorResponse("INVALID_ARGUMENT", "claimId or orderId is required.", correlationId, 400);
        }
        if (parsed.data.claimId) {
          const claim = await electromart.getClaimStatus(parsed.data.claimId);
          return withCorrelationHeaders(NextResponse.json({ claim }), correlationId);
        }
        if (parsed.data.orderId) {
          const claim = await electromart.getClaimForOrder(parsed.data.orderId);
          return withCorrelationHeaders(NextResponse.json({ claim }), correlationId);
        }
        return createErrorResponse("INVALID_ARGUMENT", "claimId or orderId is required.", correlationId, 400);
      }
      case "create_return": {
        const parsed = lookupSchema.safeParse(body);
        if (!parsed.success) {
          return createErrorResponse(
            "INVALID_ARGUMENT",
            "orderId and lastName are required.",
            correlationId,
            400,
          );
        }
        const order = await electromart.createReturn(parsed.data);
        return withCorrelationHeaders(NextResponse.json({ order }), correlationId);
      }
      case "submit_warranty_claim": {
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
            "orderId, lastName, amount and idempotencyKey are required.",
            correlationId,
            400,
          );
        }
        const claim = await electromart.submitWarrantyClaim(parsed.data);
        return withCorrelationHeaders(NextResponse.json({ claim }), correlationId);
      }
      default:
        return createErrorResponse("UNKNOWN_TOOL", "Unknown ElectroMart tool.", correlationId, 400);
    }
  } catch (error) {
    return handleProviderError(error, correlationId);
  }
}
