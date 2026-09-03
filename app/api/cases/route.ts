import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  createCaseRepository,
  getAuthenticatedUserId,
} from "@/src/application/auth/session";
import {
  createCase,
  createCaseCommandSchema,
} from "@/src/application/commands/create-case";
import { listCases } from "@/src/application/queries/cases";
import {
  generateCorrelationId,
  getCorrelationIdFromHeaders,
} from "@/src/infrastructure/observability/correlation";
import { createRequestLogger } from "@/src/infrastructure/observability/logger";
import {
  createErrorResponse,
  withCorrelationHeaders,
} from "@/src/lib/api/error-response";

export async function GET(request: NextRequest) {
  const correlationId =
    getCorrelationIdFromHeaders(request.headers) ?? generateCorrelationId();
  const logger = createRequestLogger(request.headers, "api.cases.list");

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
    const cases = await listCases(repository, userId);
    const response = NextResponse.json({ cases });
    return withCorrelationHeaders(response, correlationId);
  } catch (error) {
    logger.error("Failed to list cases", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return createErrorResponse(
      "CASE_LIST_FAILED",
      "Unable to list cases.",
      correlationId,
      500,
      true,
    );
  }
}

export async function POST(request: NextRequest) {
  const correlationId =
    getCorrelationIdFromHeaders(request.headers) ?? generateCorrelationId();
  const logger = createRequestLogger(request.headers, "api.cases.create");

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

  const parsed = createCaseCommandSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      "VALIDATION_FAILED",
      "Case input failed validation.",
      correlationId,
      400,
    );
  }

  try {
    const repository = await createCaseRepository();
    const created = await createCase(repository, userId, parsed.data);
    logger.info("Case created", { caseId: created.id });
    const response = NextResponse.json({ case: created }, { status: 201 });
    return withCorrelationHeaders(response, correlationId);
  } catch (error) {
    logger.error("Failed to create case", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return createErrorResponse(
      "CASE_CREATE_FAILED",
      "Unable to create case.",
      correlationId,
      500,
      true,
    );
  }
}
