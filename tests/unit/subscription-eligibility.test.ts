import { describe, expect, it } from "vitest";
import { evaluateSubscriptionRefund } from "@/src/domain/eligibility/evaluate-subscription-refund";
import { EligibilityInputError } from "@/src/domain/eligibility/types";

describe("evaluateSubscriptionRefund", () => {
  it("uses the later charge when billed after cancel", () => {
    const decision = evaluateSubscriptionRefund({
      subscriptionFound: true,
      status: "cancelled",
      cancelledAt: "2026-08-12T10:00:00.000Z",
      lastChargedAt: "2026-08-27T10:00:00.000Z",
      lastChargeAmount: "12.99",
      currency: "EUR",
      existingRefund: false,
    });
    expect(decision.outcome).toBe("eligible");
    expect(decision.amount).toBe("12.99");
  });

  it("does not hardcode 12.99 — a different charge yields that charge", () => {
    const decision = evaluateSubscriptionRefund({
      subscriptionFound: true,
      status: "cancelled",
      cancelledAt: "2026-08-12T10:00:00.000Z",
      lastChargedAt: "2026-08-27T10:00:00.000Z",
      lastChargeAmount: "8.50",
      currency: "EUR",
      existingRefund: false,
    });
    expect(decision.amount).toBe("8.50");
  });

  it("rejects still-active plans", () => {
    const decision = evaluateSubscriptionRefund({
      subscriptionFound: true,
      status: "active",
      cancelledAt: null,
      lastChargedAt: "2026-08-27T10:00:00.000Z",
      lastChargeAmount: "12.99",
      currency: "EUR",
      existingRefund: false,
    });
    expect(decision.outcome).toBe("ineligible");
    expect(decision.amount).toBeNull();
  });

  it("rejects subscriptions that already have a refund", () => {
    const decision = evaluateSubscriptionRefund({
      subscriptionFound: true,
      status: "cancelled",
      cancelledAt: "2026-07-01T10:00:00.000Z",
      lastChargedAt: "2026-07-02T10:00:00.000Z",
      lastChargeAmount: "12.99",
      currency: "EUR",
      existingRefund: true,
    });
    expect(decision.outcome).toBe("ineligible");
    expect(decision.amount).toBeNull();
  });

  it("returns uncertain when no subscription matches", () => {
    const decision = evaluateSubscriptionRefund({
      subscriptionFound: false,
      status: null,
      cancelledAt: null,
      lastChargedAt: null,
      lastChargeAmount: null,
      currency: "EUR",
      existingRefund: false,
    });
    expect(decision.outcome).toBe("uncertain");
    expect(decision.amount).toBeNull();
  });

  it("throws on malformed charge", () => {
    expect(() =>
      evaluateSubscriptionRefund({
        subscriptionFound: true,
        status: "cancelled",
        cancelledAt: "2026-08-12T10:00:00.000Z",
        lastChargedAt: "2026-08-27T10:00:00.000Z",
        lastChargeAmount: "nope",
        currency: "EUR",
        existingRefund: false,
      }),
    ).toThrow(EligibilityInputError);
  });
});
