import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createCaseRepository,
  getAuthenticatedUserId,
} from "@/src/application/auth/session";
import { OpenMailError, openMailAsCase } from "@/src/application/commands/open-mail-as-case";
import { createServerSupabaseClient } from "@/src/infrastructure/db/supabase/server";
import {
  generateCorrelationId,
  getCorrelationIdFromHeaders,
} from "@/src/infrastructure/observability/correlation";
import { createErrorResponse, withCorrelationHeaders } from "@/src/lib/api/error-response";

const bodySchema = z.object({
  messageKey: z.string().min(3).max(80),
});

export async function POST(request: Request) {
  const correlationId =
    getCorrelationIdFromHeaders(request.headers) ?? generateCorrelationId();
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return createErrorResponse("UNAUTHORIZED", "Authentication is required.", correlationId, 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse("INVALID_JSON", "Request body must be valid JSON.", correlationId, 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("INVALID_ARGUMENT", "messageKey is required.", correlationId, 400);
  }

  try {
    const repository = await createCaseRepository();
    const client = await createServerSupabaseClient();
    const opened = await openMailAsCase({
      repository,
      client,
      userId,
      messageKey: parsed.data.messageKey,
      investigate: true,
    });
    return withCorrelationHeaders(
      NextResponse.json({
        case: opened.caseRecord,
        investigationError: opened.investigationError,
      }),
      correlationId,
    );
  } catch (error) {
    if (error instanceof OpenMailError) {
      const status = error.code === "MAIL_NOT_FOUND" ? 404 : 409;
      return createErrorResponse(error.code, error.message, correlationId, status);
    }
    return createErrorResponse(
      "MAIL_OPEN_FAILED",
      "Unable to open that thread as a case.",
      correlationId,
      500,
      true,
    );
  }
}
