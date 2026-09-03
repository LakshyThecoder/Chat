import { describe, expect, it } from "vitest";
import { buildAppHealthResponse } from "@/src/application/health/app-health";
import {
  DATABASE_HEALTH_MESSAGES,
  buildDatabaseHealthResponse,
  getDatabaseHealthHttpStatus,
} from "@/src/application/health/db-health";

describe("health responses", () => {
  it("builds app health payload", () => {
    const response = buildAppHealthResponse("req_123");

    expect(response).toEqual({
      status: "ok",
      service: "aegis",
      timestamp: expect.any(String),
      requestId: "req_123",
    });
  });

  it("maps database health statuses to HTTP codes", () => {
    expect(getDatabaseHealthHttpStatus("ok")).toBe(200);
    expect(getDatabaseHealthHttpStatus("degraded")).toBe(503);
    expect(getDatabaseHealthHttpStatus("error")).toBe(500);
  });

  it("builds database health payload with user-safe messages only", () => {
    const response = buildDatabaseHealthResponse("req_db", {
      status: "error",
      configured: true,
      message: DATABASE_HEALTH_MESSAGES.unavailable,
    });

    expect(response.requestId).toBe("req_db");
    expect(response.status).toBe("error");
    expect(response.configured).toBe(true);
    expect(response.message).toBe(DATABASE_HEALTH_MESSAGES.unavailable);
  });
});
