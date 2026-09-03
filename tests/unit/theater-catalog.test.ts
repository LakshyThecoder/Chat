import { describe, expect, it } from "vitest";
import { isCatalogBlocked, workItemNarrative } from "@/src/domain/theater/catalog";

describe("theater catalog", () => {
  it("marks FR0999 / BERG as blocked before inspect", () => {
    const identity = { providerId: "flyright" as const, locator: "FR0999", lastName: "BERG" };
    expect(isCatalogBlocked(identity)).toBe(true);
    expect(workItemNarrative(identity).problem).toMatch(/already has a claim/i);
  });

  it("does not block a fresh FlyRight ticket", () => {
    expect(
      isCatalogBlocked({ providerId: "flyright", locator: "FR1234", lastName: "MOREAU" }),
    ).toBe(false);
  });
});
