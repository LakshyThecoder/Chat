import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUserId } from "@/src/application/auth/session";
import { createServerSupabaseClient } from "@/src/infrastructure/db/supabase/server";
import { DEFAULT_AUTONOMY_POLICY } from "@/src/domain/permissions/types";
import {
  generateCorrelationId,
  getCorrelationIdFromHeaders,
} from "@/src/infrastructure/observability/correlation";
import { createErrorResponse, withCorrelationHeaders } from "@/src/lib/api/error-response";

const schema = z.object({
  investigate_allowed: z.boolean(),
  prepare_allowed: z.boolean(),
  high_impact_ask_above_cents: z.number().int().min(0).max(10_000_000),
  kill_switch: z.boolean(),
});

export async function GET(request: NextRequest) {
  const correlationId =
    getCorrelationIdFromHeaders(request.headers) ?? generateCorrelationId();
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return createErrorResponse("UNAUTHORIZED", "Authentication is required.", correlationId, 401);
  }

  const client = await createServerSupabaseClient();
  const { data } = await client.from("autonomy_policies").select("*").eq("user_id", userId).maybeSingle();

  const policy = data ?? {
    investigate_allowed: DEFAULT_AUTONOMY_POLICY.investigateAllowed,
    prepare_allowed: DEFAULT_AUTONOMY_POLICY.prepareAllowed,
    high_impact_ask_above_cents: DEFAULT_AUTONOMY_POLICY.highImpactAskAboveCents,
    kill_switch: DEFAULT_AUTONOMY_POLICY.killSwitch,
  };

  return withCorrelationHeaders(NextResponse.json({ policy }), correlationId);
}

export async function PUT(request: NextRequest) {
  const correlationId =
    getCorrelationIdFromHeaders(request.headers) ?? generateCorrelationId();
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return createErrorResponse("UNAUTHORIZED", "Authentication is required.", correlationId, 401);
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return createErrorResponse("VALIDATION_FAILED", "Invalid autonomy policy.", correlationId, 400);
  }

  const client = await createServerSupabaseClient();
  const { error } = await client.from("autonomy_policies").upsert({
    user_id: userId,
    ...parsed.data,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return createErrorResponse("SAVE_FAILED", error.message, correlationId, 500, true);
  }

  return withCorrelationHeaders(NextResponse.json({ policy: parsed.data }), correlationId);
}
