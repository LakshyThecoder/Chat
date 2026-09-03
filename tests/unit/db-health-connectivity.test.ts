import { afterEach, describe, expect, it, vi } from "vitest";

const { fromMock, createClientMock } = vi.hoisted(() => {
  const fromMock = vi.fn();
  const createClientMock = vi.fn(() => ({ from: fromMock }));
  return { fromMock, createClientMock };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

vi.mock("@/src/config/env", () => ({
  getPublicEnv: () => ({
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-test-key",
  }),
}));

import { DATABASE_HEALTH_MESSAGES } from "@/src/application/health/db-health";
import { checkDatabaseConnectivity } from "@/src/infrastructure/db/supabase/health";

describe("checkDatabaseConnectivity", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns ok when the probe query succeeds", async () => {
    fromMock.mockReturnValue({
      select: () => ({
        limit: async () => ({ data: [], error: null }),
      }),
    });

    const result = await checkDatabaseConnectivity();

    expect(result).toEqual({
      status: "ok",
      configured: true,
      message: DATABASE_HEALTH_MESSAGES.verified,
    });
    expect(createClientMock).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "anon-test-key",
      expect.any(Object),
    );
  });

  it("returns a sanitized error message when the probe fails", async () => {
    fromMock.mockReturnValue({
      select: () => ({
        limit: async () => ({
          data: null,
          error: { code: "42501", message: "permission denied for table secrets" },
        }),
      }),
    });

    const result = await checkDatabaseConnectivity();

    expect(result.status).toBe("error");
    expect(result.configured).toBe(true);
    expect(result.message).toBe(DATABASE_HEALTH_MESSAGES.unavailable);
    expect(result.message).not.toContain("permission denied");
  });

  it("returns a sanitized error message when the client throws", async () => {
    fromMock.mockImplementation(() => {
      throw new Error("ECONNREFUSED 127.0.0.1");
    });

    const result = await checkDatabaseConnectivity();

    expect(result.status).toBe("error");
    expect(result.message).toBe(DATABASE_HEALTH_MESSAGES.unavailable);
    expect(result.message).not.toContain("ECONNREFUSED");
  });
});
