import { describe, expect, it } from "vitest";
import { evaluateFlightRefund } from "@/src/domain/eligibility/evaluate-flight-refund";
import { EligibilityInputError } from "@/src/domain/eligibility/types";

describe("evaluateFlightRefund", () => {
  it("returns uncertain when no booking matches", () => {
    const decision = evaluateFlightRefund({
      bookingFound: false,
      cancelledByCarrier: false,
      ticketUnused: true,
      flightStatus: null,
      farePaid: null,
      currency: "EUR",
      existingClaim: false,
    });
    expect(decision.outcome).toBe("uncertain");
    expect(decision.amount).toBeNull();
  });

  it("uses the booking fare when the carrier cancelled an unused ticket", () => {
    const decision = evaluateFlightRefund({
      bookingFound: true,
      cancelledByCarrier: true,
      ticketUnused: true,
      flightStatus: "CANCELLED",
      farePaid: "183.40",
      currency: "EUR",
      existingClaim: false,
    });
    expect(decision.outcome).toBe("eligible");
    expect(decision.amount).toBe("183.40");
  });

  it("does not hardcode 183.40 — a different fare yields that fare", () => {
    const decision = evaluateFlightRefund({
      bookingFound: true,
      cancelledByCarrier: true,
      ticketUnused: true,
      flightStatus: "CANCELLED",
      farePaid: "94.00",
      currency: "EUR",
      existingClaim: false,
    });
    expect(decision.amount).toBe("94.00");
  });

  it("rejects scheduled flights", () => {
    const decision = evaluateFlightRefund({
      bookingFound: true,
      cancelledByCarrier: false,
      ticketUnused: true,
      flightStatus: "SCHEDULED",
      farePaid: "94.00",
      currency: "EUR",
      existingClaim: false,
    });
    expect(decision.outcome).toBe("ineligible");
    expect(decision.amount).toBeNull();
  });

  it("rejects bookings that already have a carrier claim", () => {
    const decision = evaluateFlightRefund({
      bookingFound: true,
      cancelledByCarrier: true,
      ticketUnused: true,
      flightStatus: "CANCELLED",
      farePaid: "210.00",
      currency: "EUR",
      existingClaim: true,
    });
    expect(decision.outcome).toBe("ineligible");
  });

  it("throws on malformed fare", () => {
    expect(() =>
      evaluateFlightRefund({
        bookingFound: true,
        cancelledByCarrier: true,
        ticketUnused: true,
        flightStatus: "CANCELLED",
        farePaid: "abc",
        currency: "EUR",
        existingClaim: false,
      }),
    ).toThrow(EligibilityInputError);
  });
});
