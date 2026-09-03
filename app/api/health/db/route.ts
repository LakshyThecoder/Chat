import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  buildDatabaseHealthResponse,
  getDatabaseHealthHttpStatus,
} from "@/src/application/health/db-health";
import {
  generateCorrelationId,
  getCorrelationIdFromHeaders,
} from "@/src/infrastructure/observability/correlation";
import { checkDatabaseConnectivity } from "@/src/infrastructure/db/supabase/health";
import { createRequestLogger } from "@/src/infrastructure/observability/logger";
import { withCorrelationHeaders } from "@/src/lib/api/error-response";

export async function GET(request: NextRequest) {
  const correlationId =
    getCorrelationIdFromHeaders(request.headers) ?? generateCorrelationId();
  const logger = createRequestLogger(request.headers, "api.health.db");

  const result = await checkDatabaseConnectivity();
  logger.info("Database health check completed", { status: result.status, configured: result.configured });

  const response = NextResponse.json(
    buildDatabaseHealthResponse(correlationId, result),
    { status: getDatabaseHealthHttpStatus(result.status) },
  );

  return withCorrelationHeaders(response, correlationId);
}
