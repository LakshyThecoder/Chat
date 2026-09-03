import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { checkTheaterReadiness } from "@/src/application/health/theater-readiness";
import {
  generateCorrelationId,
  getCorrelationIdFromHeaders,
} from "@/src/infrastructure/observability/correlation";
import { withCorrelationHeaders } from "@/src/lib/api/error-response";

export async function GET(request: NextRequest) {
  const correlationId =
    getCorrelationIdFromHeaders(request.headers) ?? generateCorrelationId();
  const result = await checkTheaterReadiness();
  const status = result.status === "ok" ? 200 : result.status === "degraded" ? 503 : 500;
  return withCorrelationHeaders(
    NextResponse.json(
      {
        ...result,
        timestamp: new Date().toISOString(),
        requestId: correlationId,
      },
      { status },
    ),
    correlationId,
  );
}
