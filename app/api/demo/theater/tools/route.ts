import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { TheaterPermissionError } from "@/src/domain/theater/permission";
import {
  THEATER_COOKIE,
  TheaterSessionError,
  executeTheaterTool,
} from "@/src/application/commands/theater-session";
import {
  FlyRightConflictError,
  FlyRightNotFoundError,
} from "@/src/infrastructure/providers/flyright/types";
import {
  StreamlyConflictError,
  StreamlyNotFoundError,
} from "@/src/infrastructure/providers/streamly/types";
import {
  ElectroMartConflictError,
  ElectroMartNotFoundError,
} from "@/src/infrastructure/providers/electromart/types";
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
  const token = jar.get(THEATER_COOKIE)?.value;
  if (!token) {
    return createErrorResponse("THEATER_NOT_FOUND", "No theater session on this browser.", correlationId, 404);
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
    const { result, snapshot } = await executeTheaterTool({
      token,
      tool: parsed.data.tool,
      input: parsed.data.input,
    });
    return withCorrelationHeaders(NextResponse.json({ ...result, theater: snapshot }), correlationId);
  } catch (error) {
    if (error instanceof TheaterPermissionError) {
      const status = error.code === "APPROVAL_REQUIRED" ? 403 : 409;
      return createErrorResponse(error.code, error.message, correlationId, status);
    }
    if (error instanceof TheaterSessionError) {
      return createErrorResponse(error.code, error.message, correlationId, error.status);
    }
    if (error instanceof FlyRightNotFoundError || error instanceof StreamlyNotFoundError || error instanceof ElectroMartNotFoundError) {
      return createErrorResponse((error as { code: string }).code, (error as Error).message, correlationId, 404);
    }
    if (error instanceof FlyRightConflictError || error instanceof StreamlyConflictError || error instanceof ElectroMartConflictError) {
      return createErrorResponse((error as { code: string }).code, (error as Error).message, correlationId, 409);
    }
    const message = error instanceof Error ? error.message : "Tool failed.";
    return createErrorResponse("TOOL_FAILED", message, correlationId, 503, true);
  }
}

