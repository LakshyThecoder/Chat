import { describe, expect, it } from "vitest";
import {
  getPublicEnv,
  parsePublicEnv,
  parseServerEnv,
  resetEnvCacheForTests,
} from "@/src/config/env";

describe("env validation", () => {
  it("parses required public env", () => {
    resetEnvCacheForTests();

    const env = parsePublicEnv({
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    });

    expect(env.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBeUndefined();
  });

  it("rejects invalid public URLs", () => {
    expect(() =>
      parsePublicEnv({
        NEXT_PUBLIC_APP_URL: "not-a-url",
      }),
    ).toThrow(/Invalid public environment/);
  });

  it("treats empty optional values as undefined", () => {
    const env = parsePublicEnv({
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
    });

    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBeUndefined();
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBeUndefined();
  });

  it("falls back from publishable key to anon key", () => {
    const env = parsePublicEnv({
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    });

    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe("sb_publishable_test");
  });

  it("reads statically named NEXT_PUBLIC keys from process.env", () => {
    const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const previousAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-from-process";

    const env = parsePublicEnv();

    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://example.supabase.co");
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe("anon-from-process");

    if (previousUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    }
    if (previousAnon === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousAnon;
    }
  });

  it("parses server env defaults", () => {
    const env = parseServerEnv({
      NODE_ENV: "test",
    });

    expect(env.NODE_ENV).toBe("test");
    expect(env.REGOLO_BASE_URL).toBe("https://api.regolo.ai/v1");
  });

  it("caches public env", () => {
    resetEnvCacheForTests();
    const first = parsePublicEnv({
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    });
    expect(first.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
    resetEnvCacheForTests();
    const cached = getPublicEnv();
    const second = getPublicEnv();
    expect(cached).toBe(second);
  });
});
