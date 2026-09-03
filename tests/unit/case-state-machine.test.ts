import { describe, expect, it } from "vitest";
import {
  IllegalCaseTransitionError,
  assertCaseTransition,
  canTransitionCaseStatus,
} from "@/src/domain/cases/state-machine";

describe("case state machine", () => {
  it("allows DRAFT → INVESTIGATING", () => {
    expect(canTransitionCaseStatus("DRAFT", "INVESTIGATING")).toBe(true);
    expect(() => assertCaseTransition("DRAFT", "INVESTIGATING")).not.toThrow();
  });

  it("rejects illegal transitions fail-closed", () => {
    expect(canTransitionCaseStatus("DRAFT", "RESOLVED")).toBe(false);
    expect(() => assertCaseTransition("DRAFT", "RESOLVED")).toThrow(
      IllegalCaseTransitionError,
    );
  });

  it("blocks READY_FOR_REVIEW → EXECUTING without autonomy flag", () => {
    expect(() => assertCaseTransition("READY_FOR_REVIEW", "EXECUTING")).toThrow(
      IllegalCaseTransitionError,
    );
  });

  it("allows READY_FOR_REVIEW → EXECUTING when autonomy is granted", () => {
    expect(() =>
      assertCaseTransition("READY_FOR_REVIEW", "EXECUTING", {
        autonomousExecutionAllowed: true,
      }),
    ).not.toThrow();
  });
});
