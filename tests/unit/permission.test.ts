import { describe, expect, it } from "vitest";
import { evaluatePermission } from "@/src/domain/permissions/evaluate";
import { DEFAULT_AUTONOMY_POLICY } from "@/src/domain/permissions/types";

describe("evaluatePermission", () => {
  it("requires approval above the euro threshold", () => {
    const result = evaluatePermission({
      riskClass: "HIGH_IMPACT",
      amountCents: 18340,
      policy: DEFAULT_AUTONOMY_POLICY,
    });
    expect(result.decision).toBe("require_approval");
  });

  it("allows high-impact under the threshold", () => {
    const result = evaluatePermission({
      riskClass: "HIGH_IMPACT",
      amountCents: 5000,
      policy: DEFAULT_AUTONOMY_POLICY,
    });
    expect(result.decision).toBe("allow");
  });

  it("denies consequential work when the kill switch is on", () => {
    const result = evaluatePermission({
      riskClass: "HIGH_IMPACT",
      amountCents: 5000,
      policy: { ...DEFAULT_AUTONOMY_POLICY, killSwitch: true },
    });
    expect(result.decision).toBe("deny");
  });

  it("requires approval when amount is unknown", () => {
    const result = evaluatePermission({
      riskClass: "HIGH_IMPACT",
      amountCents: null,
      policy: DEFAULT_AUTONOMY_POLICY,
    });
    expect(result.decision).toBe("require_approval");
  });
});
