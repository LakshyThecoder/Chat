import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  ExaNotConfiguredError,
  ExaResearchError,
  passengerRightsResearchInputSchema,
  researchPassengerRights,
} from "@/src/infrastructure/research/exa-passenger-rights";
import {
  generateCorrelationId,
  getCorrelationIdFromHeaders,
} from "@/src/infrastructure/observability/correlation";
import { createErrorResponse, withCorrelationHeaders } from "@/src/lib/api/error-response";

export async function POST(request: NextRequest) {
  const correlationId =
    getCorrelationIdFromHeaders(request.headers) ?? generateCorrelationId();

  try {
    const input = passengerRightsResearchInputSchema.parse(await request.json());
    const research = await researchPassengerRights(input);
    return withCorrelationHeaders(NextResponse.json(research), correlationId);
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return createErrorResponse(
        "INVALID_RESEARCH_REQUEST",
        "Provide valid airport codes, rights regime, and disruption type.",
        correlationId,
        400,
      );
    }
    if (error instanceof ExaNotConfiguredError) {
      return createErrorResponse(error.code, error.message, correlationId, 503);
    }
    if (error instanceof ExaResearchError) {
      return createErrorResponse(error.code, error.message, correlationId, 502, true);
    }
    return createErrorResponse(
      "RESEARCH_UNAVAILABLE",
      "Official-source research is temporarily unavailable.",
      correlationId,
      500,
      true,
    );
  }
}
