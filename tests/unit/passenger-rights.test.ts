import { describe, expect, it } from "vitest";
import { greatCircleKm } from "@/src/domain/eligibility/airports";
import {
  evaluatePassengerRights,
  inferPassengerRightsInputs,
} from "@/src/domain/eligibility/evaluate-passenger-rights";

describe("evaluatePassengerRights", () => {
  it("computes CDG–FCO as a short-haul EU261 band of €250", () => {
    const km = greatCircleKm("CDG", "FCO");
    expect(km).toBeGreaterThan(1000);
    expect(km).toBeLessThan(1500);

    const rights = evaluatePassengerRights(
      inferPassengerRightsInputs({
        bookingFound: true,
        origin: "CDG",
        destination: "FCO",
        cancelledByCarrier: true,
        ticketUnused: true,
        flightStatus: "CANCELLED",
        farePaid: "183.40",
        currency: "EUR",
        existingClaim: false,
      }),
    );

    expect(rights.filing.outcome).toBe("eligible");
    expect(rights.filing.amount).toBe("183.40");
    const eu = rights.lines.find((line) => line.regime === "EU261");
    expect(eu?.decision.outcome).toBe("eligible");
    expect(eu?.decision.amount).toBe("250.00");
    expect(rights.applicableRegimes).toContain("EU261");
    expect(rights.applicableRegimes).toContain("FARE_REFUND");
  });

  it("does not invent extraordinary circumstances", () => {
    const denied = evaluatePassengerRights(
      inferPassengerRightsInputs({
        bookingFound: true,
        origin: "CDG",
        destination: "FCO",
        cancelledByCarrier: true,
        ticketUnused: true,
        flightStatus: "CANCELLED",
        farePaid: "183.40",
        currency: "EUR",
        existingClaim: false,
        extraordinaryCircumstances: true,
      }),
    );
    const eu = denied.lines.find((line) => line.regime === "EU261");
    expect(eu?.decision.outcome).toBe("ineligible");
    expect(eu?.decision.amount).toBeNull();
    expect(denied.filing.outcome).toBe("eligible");
  });

  it("rejects an already-claimed booking on every line", () => {
    const rights = evaluatePassengerRights(
      inferPassengerRightsInputs({
        bookingFound: true,
        origin: "AMS",
        destination: "LHR",
        cancelledByCarrier: true,
        ticketUnused: true,
        flightStatus: "CANCELLED",
        farePaid: "210.00",
        currency: "EUR",
        existingClaim: true,
      }),
    );
    expect(rights.filing.outcome).toBe("ineligible");
    for (const line of rights.lines) {
      expect(line.decision.outcome).not.toBe("eligible");
    }
  });

  it("treats a scheduled on-time flight as ineligible", () => {
    const rights = evaluatePassengerRights(
      inferPassengerRightsInputs({
        bookingFound: true,
        origin: "CDG",
        destination: "FCO",
        cancelledByCarrier: false,
        ticketUnused: true,
        flightStatus: "SCHEDULED",
        farePaid: "94.00",
        currency: "EUR",
        existingClaim: false,
        noticeDaysBeforeDeparture: null,
      }),
    );
    expect(rights.filing.outcome).toBe("ineligible");
    expect(rights.lines.find((line) => line.regime === "EU261")?.decision.outcome).toBe("ineligible");
  });

  it("pays UK261 in GBP for a UK departure", () => {
    const rights = evaluatePassengerRights(
      inferPassengerRightsInputs({
        bookingFound: true,
        origin: "LHR",
        destination: "JFK",
        cancelledByCarrier: true,
        ticketUnused: true,
        flightStatus: "CANCELLED",
        farePaid: "640.00",
        currency: "GBP",
        existingClaim: false,
        operatingCarrierRegion: "UK",
      }),
    );
    const uk = rights.lines.find((line) => line.regime === "UK261");
    expect(uk?.decision.outcome).toBe("eligible");
    expect(uk?.decision.currency).toBe("GBP");
    expect(uk?.decision.amount).toBe("520.00");
    expect(rights.lines.find((line) => line.regime === "EU261")).toBeUndefined();
  });

  it("DOT refunds fare on a US cancellation and never pays delay cash", () => {
    const cancel = evaluatePassengerRights(
      inferPassengerRightsInputs({
        bookingFound: true,
        origin: "JFK",
        destination: "BOS",
        cancelledByCarrier: true,
        ticketUnused: true,
        flightStatus: "CANCELLED",
        farePaid: "188.00",
        currency: "USD",
        existingClaim: false,
        operatingCarrierRegion: "US",
      }),
    );
    expect(cancel.lines.find((line) => line.regime === "DOT")?.decision.amount).toBe("188.00");

    const shortDelay = evaluatePassengerRights(
      inferPassengerRightsInputs({
        bookingFound: true,
        origin: "JFK",
        destination: "BOS",
        cancelledByCarrier: false,
        ticketUnused: true,
        flightStatus: "ON_TIME",
        farePaid: "188.00",
        currency: "USD",
        existingClaim: false,
        operatingCarrierRegion: "US",
        arrivalDelayMinutes: 90,
        noticeDaysBeforeDeparture: null,
      }),
    );
    expect(shortDelay.lines.find((line) => line.regime === "DOT")?.decision.outcome).toBe("ineligible");
  });

  it("uses 14-day cancel notice as an ineligible statutory path", () => {
    const rights = evaluatePassengerRights(
      inferPassengerRightsInputs({
        bookingFound: true,
        origin: "CDG",
        destination: "FCO",
        cancelledByCarrier: true,
        ticketUnused: true,
        flightStatus: "CANCELLED",
        farePaid: "183.40",
        currency: "EUR",
        existingClaim: false,
        noticeDaysBeforeDeparture: 16,
      }),
    );
    expect(rights.lines.find((line) => line.regime === "EU261")?.decision.outcome).toBe("ineligible");
    expect(rights.filing.outcome).toBe("eligible");
  });
});
