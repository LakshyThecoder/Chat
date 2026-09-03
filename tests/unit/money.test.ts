import { describe, expect, it } from "vitest";
import { centsToDecimal, normalizeSqlMoney, parseDecimalToCents } from "@/src/domain/money/cents";

describe("money cents", () => {
  it("round-trips decimal strings without binary floats", () => {
    expect(parseDecimalToCents("183.40")).toBe(18340);
    expect(centsToDecimal(18340)).toBe("183.40");
    expect(parseDecimalToCents("94")).toBe(9400);
  });

  it("normalizes numeric extras from SQL without inventing a new amount", () => {
    expect(normalizeSqlMoney("12.9900")).toBe("12.99");
    expect(parseDecimalToCents("12.9900")).toBe(1299);
  });
});
