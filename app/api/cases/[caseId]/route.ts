import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  createCaseRepository,
  getAuthenticatedUserId,
} from "@/src/application/auth/session";
import { CaseNotFoundError } from "@/src/domain/cases/case-service";
import { getCaseWorkspace } from "@/src/application/queries/case-workspace";
import { createServerSupabaseClient } from "@/src/infrastructure/db/supabase/server";
import {
  generateCorrelationId,
  getCorrelationIdFromHeaders,
} from "@/src/infrastructure/observability/correlation";
import { createRequestLogger } from "@/src/infrastructure/observability/logger";
import {
  createErrorResponse,
  withCorrelationHeaders,
} from "@/src/lib/api/error-response";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ caseId: string }> },
) {
  const correlationId =
    getCorrelationIdFromHeaders(request.headers) ?? generateCorrelationId();
  const logger = createRequestLogger(request.headers, "api.cases.get");
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

  try {
    const repository = await createCaseRepository();
    const client = await createServerSupabaseClient();
    const workspace = await getCaseWorkspace({ repository, client, userId, caseId });
    const response = NextResponse.json({ workspace });
    return withCorrelationHeaders(response, correlationId);
  } catch (error) {
    if (error instanceof CaseNotFoundError) {
      return createErrorResponse(
        error.code,
        "Case not found.",
        correlationId,
        404,
      );
    }

    logger.error("Failed to load case", {
      message: error instanceof Error ? error.message : "unknown",
      caseId,
    });
    return createErrorResponse(
      "CASE_GET_FAILED",
      "Unable to load case.",
      correlationId,
      500,
      true,
    );
  }
}
