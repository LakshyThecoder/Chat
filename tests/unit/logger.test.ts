import { afterEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "@/src/infrastructure/observability/logger";

describe("logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes structured JSON logs with correlation ID", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const logger = createLogger({ correlationId: "req_abc", component: "test" });

    logger.info("hello", { foo: "bar" });

    expect(spy).toHaveBeenCalledOnce();
    const payload = JSON.parse(String(spy.mock.calls[0]?.[0])) as {
      level: string;
      message: string;
      correlationId: string;
      component: string;
      meta: { foo: string };
    };

    expect(payload.level).toBe("info");
    expect(payload.message).toBe("hello");
    expect(payload.correlationId).toBe("req_abc");
    expect(payload.component).toBe("test");
    expect(payload.meta.foo).toBe("bar");
  });

  it("creates child loggers with merged context", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const parent = createLogger({ correlationId: "req_parent", component: "parent" });
    const child = parent.child({ component: "child" });

    child.info("nested");

    const payload = JSON.parse(String(spy.mock.calls[0]?.[0])) as {
      correlationId: string;
      component: string;
    };

    expect(payload.correlationId).toBe("req_parent");
    expect(payload.component).toBe("child");
  });
});
