import "server-only";

import { createClient } from "@supabase/supabase-js";
import {
  DATABASE_HEALTH_MESSAGES,
  type DatabaseHealthResult,
} from "@/src/application/health/db-health";
import { getPublicEnv } from "@/src/config/env";
import { createLogger } from "@/src/infrastructure/observability/logger";

const logger = createLogger({ component: "db.health" });

function createHealthProbeClient() {
  const publicEnv = getPublicEnv();

  if (!publicEnv.NEXT_PUBLIC_SUPABASE_URL || !publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Supabase health probe client is not configured");
  }

  return createClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

export async function checkDatabaseConnectivity(): Promise<DatabaseHealthResult> {
  const publicEnv = getPublicEnv();

  const configured = Boolean(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL && publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  if (!configured) {
    return {
      status: "degraded",
      configured: false,
      message: DATABASE_HEALTH_MESSAGES.notConfigured,
    };
  }

  try {
    const client = createHealthProbeClient();
    const { error } = await client.from("health_check").select("id").limit(1);

    if (error) {
      logger.error("Database health probe failed", {
        code: error.code,
        // Do not include full PostgREST payloads that might leak schema details broadly.
        message: error.message,
      });

      return {
        status: "error",
        configured: true,
        message: DATABASE_HEALTH_MESSAGES.unavailable,
      };
    }

    return {
      status: "ok",
      configured: true,
      message: DATABASE_HEALTH_MESSAGES.verified,
    };
  } catch (error) {
    logger.error("Database health probe threw", {
      message: error instanceof Error ? error.message : "unknown",
    });

    return {
      status: "error",
      configured: true,
      message: DATABASE_HEALTH_MESSAGES.unavailable,
    };
  }
}
