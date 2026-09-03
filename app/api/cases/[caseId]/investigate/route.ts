import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  createCaseRepository,
  getAuthenticatedUserId,
} from "@/src/application/auth/session";
import { InvestigationError, investigateCase } from "@/src/application/commands/investigate-case";
import { CaseNotFoundError } from "@/src/domain/cases/case-service";
import { createServerSupabaseClient } from "@/src/infrastructure/db/supabase/server";
import {
  generateCorrelationId,
  getCorrelationIdFromHeaders,
} from "@/src/infrastructure/observability/correlation";
import { createRequestLogger } from "@/src/infrastructure/observability/logger";
import { createErrorResponse, withCorrelationHeaders } from "@/src/lib/api/error-response";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ caseId: string }> },
) {
  const correlationId =
    getCorrelationIdFromHeaders(request.headers) ?? generateCorrelationId();
  const logger = createRequestLogger(request.headers, "api.cases.investigate");
  const { caseId } = await context.params;
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return createErrorResponse("UNAUTHORIZED", "Authentication is required.", correlationId, 401);
  }

  try {
    const repository = await createCaseRepository();
    const client = await createServerSupabaseClient();
    const updated = await investigateCase({ repository, client, userId, caseId });
    logger.info("Investigation completed", { caseId, status: updated.status });
    return withCorrelationHeaders(NextResponse.json({ case: updated }), correlationId);
  } catch (error) {
    if (error instanceof CaseNotFoundError) {
      return createErrorResponse(error.code, "Case not found.", correlationId, 404);
    }
    if (error instanceof InvestigationError) {
      const status = error.code === "NEEDS_BOOKING_IDENTITY" ? 422 : 400;
      return createErrorResponse(error.code, error.message, correlationId, status);
    }
    logger.error("Investigation failed", {
      message: error instanceof Error ? error.message : "unknown",
      caseId,
    });
    return createErrorResponse(
      "INVESTIGATION_FAILED",
      "Unable to investigate this case.",
      correlationId,
      500,
      true,
    );
  }
}
