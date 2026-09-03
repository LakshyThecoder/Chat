import { describe, expect, it } from "vitest";
import {
  THEATER_TOOLS,
  parseTheaterToolName,
  parseWorkItemId,
} from "@/src/domain/theater/tools";
import { TheaterSessionError } from "@/src/domain/theater/errors";

describe("theater WebMCP contract", () => {
  it("registers eight typed tools with schemas and side effects", () => {
    expect(THEATER_TOOLS.map((tool) => tool.name)).toEqual([
      "list_work_items",
      "get_work_item",
      "inspect_counter",
      "compute_entitlement",
      "prepare_filing",
      "request_signature",
      "execute_filing",
      "verify_filing",
    ]);
    for (const tool of THEATER_TOOLS) {
      expect(tool.inputSchema).toBeTruthy();
      expect(tool.authorization).toBe("session-cookie");
      expect(tool.description.length).toBeGreaterThan(40);
    }
  });

  it("keeps execute human-gated and verify fail-closed in the contract copy", () => {
    const execute = THEATER_TOOLS.find((tool) => tool.name === "execute_filing");
    const verify = THEATER_TOOLS.find((tool) => tool.name === "verify_filing");
    expect(execute?.description).toMatch(/APPROVAL_REQUIRED/);
    expect(execute?.sideEffect).toBe("mutate");
    expect(execute?.idempotent).toBe(true);
    expect(verify?.description).toMatch(/matched=true/);
    expect(verify?.sideEffect).toBe("verify");
  });

  it("rejects unknown tools and malformed work item ids", () => {
    expect(() => parseTheaterToolName("scrape_page")).toThrow();
    expect(() => parseWorkItemId({})).toThrow(TheaterSessionError);
    expect(() => parseWorkItemId({ workItemId: "not-a-uuid" })).toThrow(/UUID/);
  });
});
