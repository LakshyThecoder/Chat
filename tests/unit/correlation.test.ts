import { describe, expect, it } from "vitest";
import {
  CORRELATION_ID_HEADER,
  generateCorrelationId,
  getCorrelationIdFromHeaders,
} from "@/src/infrastructure/observability/correlation";

describe("correlation IDs", () => {
  it("generates non-empty correlation IDs", () => {
    const id = generateCorrelationId();
    expect(id.length).toBeGreaterThan(0);
  });

  it("reads correlation ID from headers", () => {
    const headers = new Headers({
      [CORRELATION_ID_HEADER]: "req_test_123",
    });

    expect(getCorrelationIdFromHeaders(headers)).toBe("req_test_123");
  });

  it("returns undefined when correlation ID is missing", () => {
    expect(getCorrelationIdFromHeaders(new Headers())).toBeUndefined();
  });
});
