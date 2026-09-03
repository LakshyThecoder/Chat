import { describe, expect, it } from "vitest";
import { generateChamberLocator, isChamberLocator } from "@/src/domain/chamber/locator";
import {
  ChamberPermissionError,
  assertChamberSubmit,
  deriveChamberApproval,
} from "@/src/domain/chamber/permission";

const base = {
  now: new Date("2026-09-03T12:00:00.000Z"),
  expiresAt: "2026-09-04T12:00:00.000Z",
  approvedAt: "2026-09-03T11:00:00.000Z",
  deniedAt: null as string | null,
  sessionLocator: "AG7K2MQR",
  sessionLastName: "MOREAU",
  requestedLocator: "AG7K2MQR",
  requestedLastName: "MOREAU",
  approvedAmount: "183.40",
  requestedAmount: "183.40",
};

describe("chamber locators", () => {
  it("issues AG + 6 unambiguous characters", () => {
    const locator = generateChamberLocator(() => 0);
    expect(locator).toBe("AGAAAAAA");
    expect(isChamberLocator(locator)).toBe(true);
  });

  it("rejects catalog locators as chamber tickets", () => {
    expect(isChamberLocator("FR1842")).toBe(false);
  });
});

describe("chamber submit gate", () => {
  it("blocks unsigned filings", () => {
    expect(() =>
      assertChamberSubmit({ ...base, approvedAt: null }),
    ).toThrow(ChamberPermissionError);
    try {
      assertChamberSubmit({ ...base, approvedAt: null });
    } catch (error) {
      expect(error).toBeInstanceOf(ChamberPermissionError);
      expect((error as ChamberPermissionError).code).toBe("APPROVAL_REQUIRED");
    }
  });

  it("blocks a denied filing", () => {
    expect(() =>
      assertChamberSubmit({
        ...base,
        approvedAt: null,
        deniedAt: "2026-09-03T11:00:00.000Z",
      }),
    ).toThrow(/denied/i);
  });

  it("blocks a different ticket than the one on the page", () => {
    expect(() =>
      assertChamberSubmit({ ...base, requestedLocator: "FR1842" }),
    ).toThrow(/AG7K2MQR/);
  });

  it("blocks amount that was not signed", () => {
    expect(() =>
      assertChamberSubmit({ ...base, requestedAmount: "10.00" }),
    ).toThrow(/183\.40/);
  });

  it("allows a signed matching filing", () => {
    expect(() => assertChamberSubmit(base)).not.toThrow();
  });

  it("derives approval from timestamps", () => {
    expect(deriveChamberApproval({ approvedAt: null, deniedAt: null })).toBe("unsigned");
    expect(deriveChamberApproval({ approvedAt: "x", deniedAt: null })).toBe("approved");
    expect(deriveChamberApproval({ approvedAt: null, deniedAt: "x" })).toBe("denied");
  });
});
