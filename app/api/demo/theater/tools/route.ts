import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { TheaterPermissionError } from "@/src/domain/theater/permission";
import { permissionErrorStatus } from "@/src/domain/theater/state";
import { theaterToolNameSchema } from "@/src/domain/theater/tools";
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
import { z } from "zod";

const bodySchema = z.object({
  tool: theaterToolNameSchema,
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
    return createErrorResponse("INVALID_ARGUMENT", "tool must be a known theater tool.", correlationId, 400);
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
      const code = error.code === "EXPIRED" ? "SESSION_EXPIRED" : error.code;
      return createErrorResponse(code, error.message, correlationId, permissionErrorStatus(error.code));
    }
    if (error instanceof TheaterSessionError) {
      return createErrorResponse(error.code, error.message, correlationId, error.status);
    }
    if (
      error instanceof FlyRightNotFoundError ||
      error instanceof StreamlyNotFoundError ||
      error instanceof ElectroMartNotFoundError
    ) {
      return createErrorResponse((error as { code: string }).code, (error as Error).message, correlationId, 404);
    }
    if (
      error instanceof FlyRightConflictError ||
      error instanceof StreamlyConflictError ||
      error instanceof ElectroMartConflictError
    ) {
      return createErrorResponse("PROVIDER_CONFLICT", (error as Error).message, correlationId, 409);
    }
    const message = error instanceof Error ? error.message : "Tool failed.";
    return createErrorResponse("TOOL_FAILED", message, correlationId, 503, true);
  }
}
