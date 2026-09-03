import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { buildAppHealthResponse } from "@/src/application/health/app-health";
import {
  generateCorrelationId,
  getCorrelationIdFromHeaders,
} from "@/src/infrastructure/observability/correlation";
import { createRequestLogger } from "@/src/infrastructure/observability/logger";
import { withCorrelationHeaders } from "@/src/lib/api/error-response";

export async function GET(request: NextRequest) {
  const correlationId =
    getCorrelationIdFromHeaders(request.headers) ?? generateCorrelationId();
  const logger = createRequestLogger(request.headers, "api.health");

  logger.info("Health check requested");

  const response = NextResponse.json(buildAppHealthResponse(correlationId));
  return withCorrelationHeaders(response, correlationId);
}
