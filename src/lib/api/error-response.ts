import { NextResponse } from "next/server";
import { CORRELATION_ID_HEADER } from "@/src/infrastructure/observability/correlation";

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId: string;
    retryable: boolean;
  };
}

export function createErrorResponse(
  code: string,
  message: string,
  requestId: string,
  status: number,
  retryable = false,
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        requestId,
        retryable,
      },
    },
    {
      status,
      headers: {
        [CORRELATION_ID_HEADER]: requestId,
      },
    },
  );
}

export function withCorrelationHeaders(
  response: NextResponse,
  correlationId: string,
): NextResponse {
  response.headers.set(CORRELATION_ID_HEADER, correlationId);
  return response;
}
