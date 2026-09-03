import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  MAIL_DESK_COOKIE,
  createMailDeskSession,
  getMailDeskSnapshot,
  mailDeskCookieOptions,
} from "@/src/application/commands/mail-desk-session";
import { MailDeskError } from "@/src/domain/mail-desk/errors";
import {
  generateCorrelationId,
  getCorrelationIdFromHeaders,
} from "@/src/infrastructure/observability/correlation";
import { createErrorResponse, withCorrelationHeaders } from "@/src/lib/api/error-response";

export async function GET(request: Request) {
  const correlationId =
    getCorrelationIdFromHeaders(new Headers(request.headers)) ?? generateCorrelationId();
  const token = (await cookies()).get(MAIL_DESK_COOKIE)?.value;
  if (!token) {
    return createErrorResponse("MAIL_DESK_NOT_FOUND", "No mail desk session on this browser.", correlationId, 404);
  }
  try {
    const desk = await getMailDeskSnapshot(token);
    return withCorrelationHeaders(NextResponse.json({ desk }), correlationId);
  } catch (error) {
    if (error instanceof MailDeskError) {
      return createErrorResponse(error.code, error.message, correlationId, error.status);
    }
    return createErrorResponse("MAIL_DESK_UNAVAILABLE", "Could not load mail desk.", correlationId, 503, true);
  }
}

export async function POST(request: Request) {
  const correlationId =
    getCorrelationIdFromHeaders(new Headers(request.headers)) ?? generateCorrelationId();
  const jar = await cookies();
  const previousToken = jar.get(MAIL_DESK_COOKIE)?.value ?? null;
  try {
    const { token, snapshot } = await createMailDeskSession({ previousToken });
    const response = NextResponse.json({ desk: snapshot });
    response.cookies.set(MAIL_DESK_COOKIE, token, mailDeskCookieOptions());
    return withCorrelationHeaders(response, correlationId);
  } catch (error) {
    if (error instanceof MailDeskError) {
      return createErrorResponse(error.code, error.message, correlationId, error.status);
    }
    const message = error instanceof Error ? error.message : "Could not open mail desk.";
    return createErrorResponse("MAIL_DESK_UNAVAILABLE", message, correlationId, 503, true);
  }
}
