import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createCaseRepository,
  getAuthenticatedUserId,
} from "@/src/application/auth/session";
import { ActionError, decideAction, executeApprovedAction } from "@/src/application/commands/execute-claim";
import { CaseNotFoundError } from "@/src/domain/cases/case-service";
import { createServerSupabaseClient } from "@/src/infrastructure/db/supabase/server";
import {
  generateCorrelationId,
  getCorrelationIdFromHeaders,
} from "@/src/infrastructure/observability/correlation";
import { createRequestLogger } from "@/src/infrastructure/observability/logger";
import { createErrorResponse, withCorrelationHeaders } from "@/src/lib/api/error-response";

const bodySchema = z.object({
  decision: z.enum(["approved", "denied"]),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ caseId: string }> },
) {
  const correlationId =
    getCorrelationIdFromHeaders(request.headers) ?? generateCorrelationId();
  const logger = createRequestLogger(request.headers, "api.cases.decide");
  const { caseId } = await context.params;
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
    return createErrorResponse("VALIDATION_FAILED", "Decision must be approved or denied.", correlationId, 400);
  }

  try {
    const repository = await createCaseRepository();
    const client = await createServerSupabaseClient();
    const updated = await decideAction({
      repository,
      client,
      userId,
      caseId,
      decision: parsed.data.decision,
    });
    logger.info("Action decided", { caseId, decision: parsed.data.decision });
    return withCorrelationHeaders(NextResponse.json({ case: updated }), correlationId);
  } catch (error) {
    if (error instanceof CaseNotFoundError) {
      return createErrorResponse(error.code, "Case not found.", correlationId, 404);
    }
    if (error instanceof ActionError) {
      const status = error.code === "APPROVAL_REQUIRED" || error.code === "PERMISSION_DENIED" ? 403 : 409;
      return createErrorResponse(error.code, error.message, correlationId, status);
    }
    logger.error("Decision failed", {
      message: error instanceof Error ? error.message : "unknown",
      caseId,
    });
    return createErrorResponse("DECISION_FAILED", "Unable to record the decision.", correlationId, 500, true);
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ caseId: string }> },
) {
  const correlationId =
    getCorrelationIdFromHeaders(request.headers) ?? generateCorrelationId();
  const { caseId } = await context.params;
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return createErrorResponse("UNAUTHORIZED", "Authentication is required.", correlationId, 401);
  }

  try {
    const repository = await createCaseRepository();
    const client = await createServerSupabaseClient();
    const updated = await executeApprovedAction({
      repository,
      client,
      userId,
      caseId,
      autonomous: false,
    });
    return withCorrelationHeaders(NextResponse.json({ case: updated }), correlationId);
  } catch (error) {
    if (error instanceof ActionError) {
      const status = error.code === "APPROVAL_REQUIRED" || error.code === "PERMISSION_DENIED" ? 403 : 409;
      return createErrorResponse(error.code, error.message, correlationId, status);
    }
    return createErrorResponse(
      "EXECUTE_FAILED",
      "Unable to execute the claim.",
      correlationId,
      500,
      true,
    );
  }
}
