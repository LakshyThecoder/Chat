import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ChamberPermissionError } from "@/src/domain/chamber/permission";
import {
  CHAMBER_COOKIE,
  ChamberSessionError,
  executeChamberTool,
} from "@/src/application/commands/chamber-session";
import {
  FlyRightConflictError,
  FlyRightNotFoundError,
} from "@/src/infrastructure/providers/flyright/types";
import {
  generateCorrelationId,
  getCorrelationIdFromHeaders,
} from "@/src/infrastructure/observability/correlation";
import { createErrorResponse, withCorrelationHeaders } from "@/src/lib/api/error-response";

const bodySchema = z.object({
  tool: z.string().min(1).max(80),
  input: z.record(z.unknown()).default({}),
});

export async function POST(request: Request) {
  const correlationId =
    getCorrelationIdFromHeaders(new Headers(request.headers)) ?? generateCorrelationId();
  const jar = await cookies();
  const token = jar.get(CHAMBER_COOKIE)?.value;
  if (!token) {
    return createErrorResponse("CHAMBER_NOT_FOUND", "No chamber session on this browser.", correlationId, 404);
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return createErrorResponse("INVALID_JSON", "Request body must be valid JSON.", correlationId, 400);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return createErrorResponse("INVALID_ARGUMENT", "tool and input are required.", correlationId, 400);
  }

  try {
    const { result, snapshot } = await executeChamberTool({
      token,
      tool: parsed.data.tool,
      input: parsed.data.input,
    });
    return withCorrelationHeaders(NextResponse.json({ ...result, chamber: snapshot }), correlationId);
  } catch (error) {
    if (error instanceof ChamberPermissionError) {
      const status = error.code === "APPROVAL_REQUIRED" ? 403 : 409;
      return createErrorResponse(error.code, error.message, correlationId, status);
    }
    if (error instanceof ChamberSessionError) {
      return createErrorResponse(error.code, error.message, correlationId, error.status);
    }
    if (error instanceof FlyRightNotFoundError) {
      return createErrorResponse(error.code, error.message, correlationId, 404);
    }
    if (error instanceof FlyRightConflictError) {
      return createErrorResponse(error.code, error.message, correlationId, 409);
    }
    const message = error instanceof Error ? error.message : "Tool failed.";
    return createErrorResponse("TOOL_FAILED", message, correlationId, 503, true);
  }
}
