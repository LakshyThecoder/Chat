import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  MAIL_DESK_COOKIE,
  decideMailDeskItem,
} from "@/src/application/commands/mail-desk-session";
import { MailDeskError } from "@/src/domain/mail-desk/errors";
import {
  generateCorrelationId,
  getCorrelationIdFromHeaders,
} from "@/src/infrastructure/observability/correlation";
import { createErrorResponse, withCorrelationHeaders } from "@/src/lib/api/error-response";

const bodySchema = z.object({
  itemId: z.string().uuid(),
  decision: z.enum(["approved", "denied"]),
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
    return createErrorResponse("INVALID_ARGUMENT", "itemId and decision are required.", correlationId, 400);
  }

  try {
    const desk = await decideMailDeskItem({
      token,
      itemId: parsed.data.itemId,
      decision: parsed.data.decision,
    });
    return withCorrelationHeaders(NextResponse.json({ desk }), correlationId);
  } catch (error) {
    if (error instanceof MailDeskError) {
      return createErrorResponse(error.code, error.message, correlationId, error.status);
    }
    return createErrorResponse("MAIL_DESK_APPROVE_FAILED", "Could not record signature.", correlationId, 500, true);
  }
}
