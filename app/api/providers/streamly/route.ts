import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createStreamlyProvider } from "@/src/infrastructure/providers/streamly/service";
import {
  StreamlyConflictError,
  StreamlyNotFoundError,
} from "@/src/infrastructure/providers/streamly/types";
import {
  generateCorrelationId,
  getCorrelationIdFromHeaders,
} from "@/src/infrastructure/observability/correlation";
import { createErrorResponse, withCorrelationHeaders } from "@/src/lib/api/error-response";

const lookupSchema = z.object({
  subscriptionId: z.string().min(3).max(32),
  accountEmail: z.string().email().max(180),
});

function handleProviderError(error: unknown, correlationId: string) {
  if (error instanceof StreamlyNotFoundError) {
    return createErrorResponse(error.code, error.message, correlationId, 404);
  }
  if (error instanceof StreamlyConflictError) {
    return createErrorResponse(error.code, error.message, correlationId, 409);
  }
  return createErrorResponse(
    "STREAMLY_UNAVAILABLE",
    "Streamly could not complete the request.",
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

  const streamly = createStreamlyProvider();

  try {
    switch (tool) {
      case "get_subscription": {
        const parsed = lookupSchema.safeParse(body);
        if (!parsed.success) {
          return createErrorResponse(
            "INVALID_ARGUMENT",
            "subscriptionId and accountEmail are required.",
            correlationId,
            400,
          );
        }
        const subscription = await streamly.getSubscription(
          parsed.data.subscriptionId,
          parsed.data.accountEmail,
        );
        return withCorrelationHeaders(NextResponse.json({ subscription }), correlationId);
      }
      case "get_billing_history": {
        const parsed = lookupSchema.safeParse(body);
        if (!parsed.success) {
          return createErrorResponse(
            "INVALID_ARGUMENT",
            "subscriptionId and accountEmail are required.",
            correlationId,
            400,
          );
        }
        const billing = await streamly.getBillingHistory(
          parsed.data.subscriptionId,
          parsed.data.accountEmail,
        );
        return withCorrelationHeaders(NextResponse.json({ billing }), correlationId);
      }
      case "get_cancellation_policy": {
        const policy = await streamly.getCancellationPolicy();
        return withCorrelationHeaders(NextResponse.json({ policy }), correlationId);
      }
      case "get_case_status": {
        const parsed = z
          .object({
            refundId: z.string().uuid().optional(),
            subscriptionId: z.string().min(3).optional(),
          })
          .safeParse(body);
        if (!parsed.success) {
          return createErrorResponse(
            "INVALID_ARGUMENT",
            "refundId or subscriptionId is required.",
            correlationId,
            400,
          );
        }
        if (parsed.data.refundId) {
          const refund = await streamly.getRefundStatus(parsed.data.refundId);
          return withCorrelationHeaders(NextResponse.json({ refund }), correlationId);
        }
        if (parsed.data.subscriptionId) {
          const refund = await streamly.getRefundForSubscription(parsed.data.subscriptionId);
          return withCorrelationHeaders(NextResponse.json({ refund }), correlationId);
        }
        return createErrorResponse(
          "INVALID_ARGUMENT",
          "refundId or subscriptionId is required.",
          correlationId,
          400,
        );
      }
      case "cancel_subscription": {
        const parsed = lookupSchema.safeParse(body);
        if (!parsed.success) {
          return createErrorResponse(
            "INVALID_ARGUMENT",
            "subscriptionId and accountEmail are required.",
            correlationId,
            400,
          );
        }
        const subscription = await streamly.cancelSubscription(parsed.data);
        return withCorrelationHeaders(NextResponse.json({ subscription }), correlationId);
      }
      case "request_refund": {
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
            "subscriptionId, accountEmail, amount and idempotencyKey are required.",
            correlationId,
            400,
          );
        }
        const refund = await streamly.requestRefund(parsed.data);
        return withCorrelationHeaders(NextResponse.json({ refund }), correlationId);
      }
      default:
        return createErrorResponse("UNKNOWN_TOOL", "Unknown Streamly tool.", correlationId, 400);
    }
  } catch (error) {
    return handleProviderError(error, correlationId);
  }
}
