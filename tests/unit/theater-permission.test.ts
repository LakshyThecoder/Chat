import { describe, expect, it } from "vitest";
import { TheaterPermissionError, assertTheaterExecute } from "@/src/domain/theater/permission";

const base = {
  now: new Date("2026-09-03T12:00:00.000Z"),
  expiresAt: "2026-09-04T12:00:00.000Z",
  status: "APPROVED" as const,
  approvedAt: "2026-09-03T11:00:00.000Z",
  deniedAt: null as string | null,
  proposalAmount: "183.40",
  proposalCurrency: "EUR",
  approvedAmount: "183.40",
  approvedCurrency: "EUR",
};

describe("theater execute gate", () => {
  it("blocks unsigned filings", () => {
    try {
      assertTheaterExecute({ ...base, approvedAt: null, status: "AWAITING_SIGNATURE" });
      throw new Error("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(TheaterPermissionError);
      expect((error as TheaterPermissionError).code).toBe("APPROVAL_REQUIRED");
    }
  });

  it("blocks execute from awaiting signature even if timestamps are messy", () => {
    expect(() => assertTheaterExecute({ ...base, status: "AWAITING_SIGNATURE" })).toThrow(/not executable/i);
  });

  it("blocks a denied filing", () => {
    expect(() =>
      assertTheaterExecute({
        ...base,
        approvedAt: null,
        deniedAt: "2026-09-03T11:00:00.000Z",
        status: "DENIED",
      }),
    ).toThrow(/denied/i);
  });

  it("blocks amount that was not signed", () => {
    expect(() => assertTheaterExecute({ ...base, approvedAmount: "10.00" })).toThrow(/does not match/i);
  });

  it("allows a signed matching filing", () => {
    expect(() => assertTheaterExecute(base)).not.toThrow();
  });

  it("allows retry from FAILED when the signature still matches", () => {
    expect(() => assertTheaterExecute({ ...base, status: "FAILED" })).not.toThrow();
  });

  it("allows idempotent execute from EXECUTED and VERIFIED", () => {
    expect(() => assertTheaterExecute({ ...base, status: "EXECUTED" })).not.toThrow();
    expect(() => assertTheaterExecute({ ...base, status: "VERIFIED" })).not.toThrow();
  });

  it("blocks an expired session", () => {
    expect(() =>
      assertTheaterExecute({ ...base, now: new Date("2026-09-05T12:00:00.000Z") }),
    ).toThrow(/expired/i);
  });
});
