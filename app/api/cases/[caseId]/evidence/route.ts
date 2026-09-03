import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  createCaseRepository,
  getAuthenticatedUserId,
} from "@/src/application/auth/session";
import {
  listCaseDocuments,
  uploadCaseDocument,
} from "@/src/application/commands/upload-document";
import { getCase } from "@/src/application/queries/cases";
import { CaseNotFoundError } from "@/src/domain/cases/case-service";
import { EvidenceValidationError } from "@/src/domain/evidence/validation";
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
    await getCase(repository, userId, caseId);
    const client = await createServerSupabaseClient();
    const documents = await listCaseDocuments({ client, userId, caseId });
    return withCorrelationHeaders(NextResponse.json({ documents }), correlationId);
  } catch (error) {
    if (error instanceof CaseNotFoundError) {
      return createErrorResponse(error.code, "Case not found.", correlationId, 404);
    }
    return createErrorResponse(
      "EVIDENCE_LIST_FAILED",
      "Unable to list evidence.",
      correlationId,
      500,
      true,
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ caseId: string }> },
) {
  const correlationId =
    getCorrelationIdFromHeaders(request.headers) ?? generateCorrelationId();
  const logger = createRequestLogger(request.headers, "api.evidence.upload");
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
    await getCase(repository, userId, caseId);

    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return createErrorResponse(
        "VALIDATION_FAILED",
        "A file field named file is required.",
        correlationId,
        400,
      );
    }

    const client = await createServerSupabaseClient();
    const document = await uploadCaseDocument({ client, userId, caseId, file });
    logger.info("Evidence uploaded", { caseId, documentId: document.id });
    return withCorrelationHeaders(
      NextResponse.json({ document }, { status: 201 }),
      correlationId,
    );
  } catch (error) {
    if (error instanceof CaseNotFoundError) {
      return createErrorResponse(error.code, "Case not found.", correlationId, 404);
    }
    if (error instanceof EvidenceValidationError) {
      return createErrorResponse(error.code, error.message, correlationId, 400);
    }

    logger.error("Evidence upload failed", {
      message: error instanceof Error ? error.message : "unknown",
      caseId,
    });
    return createErrorResponse(
      "EVIDENCE_UPLOAD_FAILED",
      "Unable to upload evidence.",
      correlationId,
      500,
      true,
    );
  }
}
