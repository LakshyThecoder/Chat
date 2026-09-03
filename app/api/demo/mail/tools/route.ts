import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  MAIL_DESK_COOKIE,
  executeMailDeskTool,
} from "@/src/application/commands/mail-desk-session";
import { MailDeskError, MailDeskPermissionError } from "@/src/domain/mail-desk/errors";
import { mailDeskToolNameSchema } from "@/src/domain/mail-desk/tools";
import {
  generateCorrelationId,
  getCorrelationIdFromHeaders,
} from "@/src/infrastructure/observability/correlation";
import { createErrorResponse, withCorrelationHeaders } from "@/src/lib/api/error-response";

const bodySchema = z.object({
  tool: mailDeskToolNameSchema,
  input: z.record(z.unknown()).default({}),
});

export async function POST(request: Request) {
  const correlationId =
    getCorrelationIdFromHeaders(new Headers(request.headers)) ?? generateCorrelationId();
  const token = (await cookies()).get(MAIL_DESK_COOKIE)?.value;
  if (!token) {
    return createErrorResponse("MAIL_DESK_NOT_FOUND", "No mail desk session on this browser.", correlationId, 404);
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return createErrorResponse("INVALID_JSON", "Request body must be valid JSON.", correlationId, 400);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return createErrorResponse("INVALID_ARGUMENT", "tool must be a known mail desk tool.", correlationId, 400);
  }

  try {
    const { result, snapshot } = await executeMailDeskTool({
      token,
      tool: parsed.data.tool,
      input: parsed.data.input,
    });
    return withCorrelationHeaders(NextResponse.json({ ...result, desk: snapshot }), correlationId);
  } catch (error) {
    if (error instanceof MailDeskPermissionError) {
      return createErrorResponse(error.code, error.message, correlationId, 403);
    }
    if (error instanceof MailDeskError) {
      return createErrorResponse(error.code, error.message, correlationId, error.status);
    }
    if (error instanceof Error && error.message.includes("UUID")) {
      return createErrorResponse("INVALID_ARGUMENT", error.message, correlationId, 400);
    }
    return createErrorResponse("MAIL_DESK_TOOL_FAILED", "Mail desk tool failed.", correlationId, 500, true);
  }
}
