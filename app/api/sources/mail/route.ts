import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/src/application/auth/session";
import {
  connectSandboxMail,
  isSandboxMailConnected,
  MailConnectionError,
} from "@/src/application/commands/connect-mail";
import { getInbox } from "@/src/application/queries/inbox";
import { getSandboxMailMessage } from "@/src/infrastructure/mail/sandbox-catalog";
import { createServerSupabaseClient } from "@/src/infrastructure/db/supabase/server";
import {
  generateCorrelationId,
  getCorrelationIdFromHeaders,
} from "@/src/infrastructure/observability/correlation";
import { createErrorResponse, withCorrelationHeaders } from "@/src/lib/api/error-response";

export async function GET(request: NextRequest) {
  const correlationId =
    getCorrelationIdFromHeaders(request.headers) ?? generateCorrelationId();
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return createErrorResponse("UNAUTHORIZED", "Authentication is required.", correlationId, 401);
  }

  const client = await createServerSupabaseClient();
  const messageKey = request.nextUrl.searchParams.get("messageKey");

  try {
    if (messageKey) {
      const connected = await isSandboxMailConnected(client, userId);
      if (!connected) {
        return createErrorResponse(
          "MAIL_NOT_CONNECTED",
          "Connect the sandbox mailbox first.",
          correlationId,
          403,
        );
      }
      const message = await getSandboxMailMessage(messageKey);
      if (!message) {
        return createErrorResponse("MAIL_NOT_FOUND", "Message not found.", correlationId, 404);
      }
      return withCorrelationHeaders(NextResponse.json({ message }), correlationId);
    }

    const inbox = await getInbox({ client, userId });
    return withCorrelationHeaders(NextResponse.json(inbox), correlationId);
  } catch (error) {
    if (error instanceof MailConnectionError) {
      return createErrorResponse(error.code, error.message, correlationId, 400);
    }
    return createErrorResponse("MAIL_READ_FAILED", "Unable to read sandbox mail.", correlationId, 500, true);
  }
}

export async function POST(request: NextRequest) {
  const correlationId =
    getCorrelationIdFromHeaders(request.headers) ?? generateCorrelationId();
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return createErrorResponse("UNAUTHORIZED", "Authentication is required.", correlationId, 401);
  }

  const client = await createServerSupabaseClient();

  try {
    const connected = await connectSandboxMail(client, userId);
    return withCorrelationHeaders(NextResponse.json(connected), correlationId);
  } catch (error) {
    if (error instanceof MailConnectionError) {
      return createErrorResponse(error.code, error.message, correlationId, 400);
    }
    return createErrorResponse("MAIL_CONNECT_FAILED", "Unable to connect sandbox mail.", correlationId, 500, true);
  }
}
