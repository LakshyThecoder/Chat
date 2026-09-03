import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  createCaseRepository,
  getAuthenticatedUserId,
} from "@/src/application/auth/session";
import { ActionError, syncClaimStatus } from "@/src/application/commands/execute-claim";
import { CaseNotFoundError } from "@/src/domain/cases/case-service";
import { createServerSupabaseClient } from "@/src/infrastructure/db/supabase/server";
import {
  generateCorrelationId,
  getCorrelationIdFromHeaders,
} from "@/src/infrastructure/observability/correlation";
import { createErrorResponse, withCorrelationHeaders } from "@/src/lib/api/error-response";

export async function POST(
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
    const updated = await syncClaimStatus({ repository, client, userId, caseId });
    return withCorrelationHeaders(NextResponse.json({ case: updated }), correlationId);
  } catch (error) {
    if (error instanceof CaseNotFoundError) {
      return createErrorResponse(error.code, "Case not found.", correlationId, 404);
    }
    if (error instanceof ActionError) {
      return createErrorResponse(error.code, error.message, correlationId, 409);
    }
    return createErrorResponse("SYNC_FAILED", "Unable to sync carrier status.", correlationId, 500, true);
  }
}
