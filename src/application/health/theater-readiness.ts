import "server-only";

import { CHAMBER_TEMPLATE } from "@/src/domain/chamber/types";
import { THEATER_BLOCKED_BOOKING } from "@/src/domain/theater/catalog";
import { getPublicEnv, getServerEnv } from "@/src/config/env";
import { createAdminSupabaseClient } from "@/src/infrastructure/db/supabase/admin";
import { createLogger } from "@/src/infrastructure/observability/logger";

const logger = createLogger({ component: "theater.readiness" });

export interface TheaterReadinessCheck {
  id: string;
  ok: boolean;
}

export interface TheaterReadinessResult {
  status: "ok" | "degraded" | "error";
  configured: boolean;
  message: string;
  checks: TheaterReadinessCheck[];
}

export const THEATER_READINESS_MESSAGES = {
  notConfigured: "Theater demo is not fully configured",
  verified: "Theater demo is ready",
  unavailable: "Theater demo is not ready",
} as const;

export async function checkTheaterReadiness(): Promise<TheaterReadinessResult> {
  const publicEnv = getPublicEnv();
  const serverEnv = getServerEnv();
  const configured = Boolean(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL && serverEnv.SUPABASE_SERVICE_ROLE_KEY,
  );

  if (!configured) {
    return {
      status: "degraded",
      configured: false,
      message: THEATER_READINESS_MESSAGES.notConfigured,
      checks: [{ id: "service_role", ok: false }],
    };
  }

  const checks: TheaterReadinessCheck[] = [{ id: "service_role", ok: true }];

  try {
    const client = createAdminSupabaseClient();

    const tables = await Promise.all([
      client.from("theater_sessions").select("id").limit(1),
      client.from("theater_work_items").select("id").limit(1),
      client.from("theater_audit_events").select("id").limit(1),
    ]);

    checks.push({ id: "theater_sessions", ok: !tables[0].error });
    checks.push({ id: "theater_work_items", ok: !tables[1].error });
    checks.push({ id: "theater_audit_events", ok: !tables[2].error });

    const template = await client
      .from("flyright_bookings")
      .select("locator")
      .eq("locator", CHAMBER_TEMPLATE.locator)
      .eq("last_name", CHAMBER_TEMPLATE.lastName)
      .maybeSingle();
    checks.push({ id: "flyright_template", ok: !template.error && Boolean(template.data) });

    const blocked = await client
      .from("flyright_claims")
      .select("id")
      .eq("locator", THEATER_BLOCKED_BOOKING.locator)
      .limit(1);
    checks.push({ id: "blocked_claim", ok: !blocked.error && (blocked.data?.length ?? 0) > 0 });

    const streamly = await client
      .from("streamly_subscriptions")
      .select("subscription_id")
      .eq("subscription_id", "SL-1001")
      .maybeSingle();
    checks.push({ id: "streamly_template", ok: !streamly.error && Boolean(streamly.data) });

    const failed = checks.filter((check) => !check.ok);
    if (failed.length > 0) {
      logger.error("Theater readiness failed", { failed: failed.map((check) => check.id) });
      return {
        status: "error",
        configured: true,
        message: THEATER_READINESS_MESSAGES.unavailable,
        checks,
      };
    }

    return {
      status: "ok",
      configured: true,
      message: THEATER_READINESS_MESSAGES.verified,
      checks,
    };
  } catch (error) {
    logger.error("Theater readiness threw", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return {
      status: "error",
      configured: true,
      message: THEATER_READINESS_MESSAGES.unavailable,
      checks,
    };
  }
}
