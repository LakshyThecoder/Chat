import { describe, expect, it } from "vitest";
import { evaluateWarrantyClaim } from "@/src/domain/eligibility/evaluate-warranty-claim";

describe("evaluateWarrantyClaim", () => {
  it("uses the purchase price when inside the warranty window", () => {
    const decision = evaluateWarrantyClaim({
      orderFound: true,
      purchasedAt: "2026-03-04T12:00:00.000Z",
      warrantyMonths: 24,
      asOf: "2026-09-03T12:00:00.000Z",
      existingClaim: false,
      returnOpened: false,
      purchasePrice: "899.00",
      currency: "EUR",
    });
    expect(decision.outcome).toBe("eligible");
    expect(decision.amount).toBe("899.00");
  });

  it("does not hardcode 899.00 — a different price yields that price", () => {
    const decision = evaluateWarrantyClaim({
      orderFound: true,
      purchasedAt: "2026-03-04T12:00:00.000Z",
      warrantyMonths: 24,
      asOf: "2026-09-03T12:00:00.000Z",
      existingClaim: false,
      returnOpened: false,
      purchasePrice: "420.00",
      currency: "EUR",
    });
    expect(decision.amount).toBe("420.00");
  });

  it("rejects expired warranties", () => {
    const decision = evaluateWarrantyClaim({
      orderFound: true,
      purchasedAt: "2023-01-10T12:00:00.000Z",
      warrantyMonths: 12,
      asOf: "2026-09-03T12:00:00.000Z",
      existingClaim: false,
      returnOpened: false,
      purchasePrice: "79.00",
      currency: "EUR",
    });
    expect(decision.outcome).toBe("ineligible");
    expect(decision.amount).toBeNull();
  });

  it("rejects orders with an existing claim or an open return", () => {
    const claimed = evaluateWarrantyClaim({
      orderFound: true,
      purchasedAt: "2026-02-01T12:00:00.000Z",
      warrantyMonths: 24,
      asOf: "2026-09-03T12:00:00.000Z",
      existingClaim: true,
      returnOpened: false,
      purchasePrice: "420.00",
      currency: "EUR",
    });
    expect(claimed.outcome).toBe("ineligible");

    const returned = evaluateWarrantyClaim({
      orderFound: true,
      purchasedAt: "2026-03-04T12:00:00.000Z",
      warrantyMonths: 24,
      asOf: "2026-09-03T12:00:00.000Z",
      existingClaim: false,
      returnOpened: true,
      purchasePrice: "899.00",
      currency: "EUR",
    });
    expect(returned.outcome).toBe("ineligible");
    expect(returned.amount).toBeNull();
  });
});
