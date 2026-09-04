import { afterEach, describe, expect, it, vi } from "vitest";
import { resetEnvCacheForTests } from "@/src/config/env";
import {
  ExaNotConfiguredError,
  ExaResearchError,
  researchPassengerRights,
} from "@/src/infrastructure/research/exa-passenger-rights";

describe("Exa passenger-rights research", () => {
  afterEach(() => {
    delete process.env.EXA_API_KEY;
    resetEnvCacheForTests();
    vi.restoreAllMocks();
  });

  it("refuses research when the server key is absent", async () => {
    delete process.env.EXA_API_KEY;
    resetEnvCacheForTests();
    await expect(
      researchPassengerRights(
        { origin: "CDG", destination: "FCO", regime: "EU261", disruption: "cancelled" },
        vi.fn(),
      ),
    ).rejects.toBeInstanceOf(ExaNotConfiguredError);
  });

  it("restricts retrieval to official regime domains and preserves citations", async () => {
    process.env.EXA_API_KEY = "test-only-key";
    resetEnvCacheForTests();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          requestId: "exa_req_1",
          results: [
            {
              title: "Air passenger rights",
              url: "https://europa.eu/youreurope/citizens/travel/passenger-rights/air/",
              highlights: ["Passengers may be entitled to reimbursement or compensation."],
            },
          ],
          output: {
            content: {
              briefing: "EU261 may entitle passengers to reimbursement and care after a short-notice cancellation.",
              compensationNotes: "Compensation depends on distance and notice.",
              careNotes: "Meals and accommodation may be due while waiting.",
              exceptions: "Extraordinary circumstances can limit compensation.",
              claimDeadline: "Unknown from official sources retrieved.",
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await researchPassengerRights(
      { origin: "CDG", destination: "FCO", regime: "EU261", disruption: "cancelled" },
      fetchMock,
    );

    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      type: string;
      includeDomains: string[];
      outputSchema: { required: string[] };
      contents: { highlights: { maxCharacters: number } };
    };
    expect(request.type).toBe("auto");
    expect(request.includeDomains).toEqual(["europa.eu", "eur-lex.europa.eu", "ec.europa.eu"]);
    expect(request.outputSchema.required).toContain("briefing");
    expect(request.contents.highlights.maxCharacters).toBe(1800);
    expect(result.sources[0]?.url).toContain("europa.eu");
    expect(result.briefing?.briefing).toMatch(/EU261/);
    expect(result.authoritativeAmount).toBe(false);
    expect(result.providerRequestId).toBe("exa_req_1");
  });

  it("rejects malformed provider output", async () => {
    process.env.EXA_API_KEY = "test-only-key";
    resetEnvCacheForTests();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ results: [{ title: "Missing URL" }] }), { status: 200 }),
    );

    await expect(
      researchPassengerRights(
        { origin: "LHR", destination: "JFK", regime: "UK261", disruption: "delayed" },
        fetchMock,
      ),
    ).rejects.toBeInstanceOf(ExaResearchError);
  });
});
