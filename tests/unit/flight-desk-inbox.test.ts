import { describe, expect, it } from "vitest";
import { AIRLINE_INBOX } from "@/src/domain/flight-desk/inbox-catalog";
import { THEATER_TOOLS } from "@/src/domain/theater/tools";

describe("flight desk catalogs", () => {
  it("keeps promotional mail as a watched itinerary", () => {
    const promo = AIRLINE_INBOX.find((thread) => thread.kind === "promo");
    expect(promo?.watchOnly).toBe(true);
    expect(promo?.origin).toBe("FRA");
    expect(promo?.destination).toBe("LHR");
  });

  it("includes a cancellation and a blocked claim thread", () => {
    expect(AIRLINE_INBOX.some((thread) => thread.kind === "cancel")).toBe(true);
    expect(AIRLINE_INBOX.some((thread) => thread.locator === "FR0999")).toBe(true);
  });

  it("retargets orchestration tools to the flight desk", () => {
    expect(THEATER_TOOLS.map((tool) => tool.name)).toContain("begin_resolution");
    expect(THEATER_TOOLS.map((tool) => tool.name)).toContain("execute_filing");
    expect(THEATER_TOOLS.find((tool) => tool.name === "begin_resolution")?.description).toMatch(/airline|FlyRight/i);
  });
});
