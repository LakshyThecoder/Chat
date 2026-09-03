export type DatabaseHealthStatus = "ok" | "degraded" | "error";

export interface DatabaseHealthResult {
  status: DatabaseHealthStatus;
  configured: boolean;
  message: string;
}

/** User-safe messages only — never forward raw infrastructure errors to clients. */
export const DATABASE_HEALTH_MESSAGES = {
  notConfigured: "Database is not fully configured",
  verified: "Database connectivity verified",
  unavailable: "Database is temporarily unavailable",
} as const;

export interface DatabaseHealthResponse {
  status: DatabaseHealthStatus;
  configured: boolean;
  message: string;
  timestamp: string;
  requestId: string;
}

export function buildDatabaseHealthResponse(
  requestId: string,
  result: DatabaseHealthResult,
): DatabaseHealthResponse {
  return {
    status: result.status,
    configured: result.configured,
    message: result.message,
    timestamp: new Date().toISOString(),
    requestId,
  };
}

export function getDatabaseHealthHttpStatus(status: DatabaseHealthStatus): number {
  switch (status) {
    case "ok":
      return 200;
    case "degraded":
      return 503;
    case "error":
      return 500;
  }
}
