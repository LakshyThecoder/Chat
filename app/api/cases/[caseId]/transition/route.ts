import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  createCaseRepository,
  getAuthenticatedUserId,
} from "@/src/application/auth/session";
import {
  transitionCase,
  transitionCaseCommandSchema,
} from "@/src/application/commands/transition-case";
import { CaseNotFoundError } from "@/src/domain/cases/case-service";
import { IllegalCaseTransitionError } from "@/src/domain/cases/state-machine";
import {
  generateCorrelationId,
  getCorrelationIdFromHeaders,
} from "@/src/infrastructure/observability/correlation";
import { createRequestLogger } from "@/src/infrastructure/observability/logger";
import {
  createErrorResponse,
  withCorrelationHeaders,
} from "@/src/lib/api/error-response";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ caseId: string }> },
) {
  const correlationId =
    getCorrelationIdFromHeaders(request.headers) ?? generateCorrelationId();
  const logger = createRequestLogger(request.headers, "api.cases.transition");
  const { caseId } = await context.params;

  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return createErrorResponse(
      "UNAUTHORIZED",
      "Authentication is required.",
      correlationId,
      401,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse(
      "INVALID_JSON",
      "Request body must be valid JSON.",
      correlationId,
      400,
    );
  }

  const parsed = transitionCaseCommandSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      "VALIDATION_FAILED",
      "Transition input failed validation.",
      correlationId,
      400,
    );
  }

  // Autonomous READY_FOR_REVIEW → EXECUTING requires the permission engine (Phase 05).
  // Until then, reject client-supplied autonomousExecutionAllowed.
  if (parsed.data.autonomousExecutionAllowed) {
    return createErrorResponse(
      "PERMISSION_ENGINE_REQUIRED",
      "Autonomous execution is not enabled until the permission engine is active.",
      correlationId,
      403,
    );
  }

  try {
    const repository = await createCaseRepository();
    const updated = await transitionCase(repository, userId, caseId, {
      ...parsed.data,
      autonomousExecutionAllowed: false,
    });
    logger.info("Case transitioned", {
      caseId,
      toStatus: updated.status,
    });
    const response = NextResponse.json({ case: updated });
    return withCorrelationHeaders(response, correlationId);
  } catch (error) {
    if (error instanceof CaseNotFoundError) {
      return createErrorResponse(error.code, "Case not found.", correlationId, 404);
    }
    if (error instanceof IllegalCaseTransitionError) {
      return createErrorResponse(
        error.code,
        "That case status transition is not allowed.",
        correlationId,
        409,
      );
    }

    logger.error("Failed to transition case", {
      message: error instanceof Error ? error.message : "unknown",
      caseId,
    });
    return createErrorResponse(
      "CASE_TRANSITION_FAILED",
      "Unable to transition case.",
      correlationId,
      500,
      true,
    );
  }
}
