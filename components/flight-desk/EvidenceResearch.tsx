"use client";

import { useEffect, useMemo, useState } from "react";
import { FLIGHT_DESK_RESEARCH_EVENT } from "@/components/flight-desk/register-flight-desk-tools";
import type { PassengerRightsDecision, RightsRegime } from "@/src/domain/eligibility/types";

interface ResearchSource {
  title: string;
  url: string;
  publishedDate: string | null;
  highlights: string[];
}

interface ResearchBriefing {
  briefing: string;
  compensationNotes: string;
  careNotes: string;
  exceptions: string;
  claimDeadline: string;
}

interface ResearchResult {
  query: string;
  regime?: string;
  briefing: ResearchBriefing | null;
  sources: ResearchSource[];
  providerRequestId: string | null;
  authoritativeAmount?: false;
}

const SUPPORTED = new Set<RightsRegime>(["EU261", "UK261", "DOT"]);

export function EvidenceResearch({
  origin,
  destination,
  cancelled,
  rights,
  researchLive,
  autoRun = true,
}: {
  origin: string | null;
  destination: string | null;
  cancelled: boolean;
  rights: PassengerRightsDecision | null;
  researchLive: boolean;
  autoRun?: boolean;
}) {
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const regime = useMemo(
    () => rights?.applicableRegimes.find((value) => SUPPORTED.has(value)) ?? null,
    [rights],
  );
  const canRun = Boolean(origin && destination && regime && researchLive);

  useEffect(() => {
    function onResearch(event: Event) {
      const detail = (event as CustomEvent<ResearchResult>).detail;
      if (!detail?.sources) return;
      setResult(detail);
      setStatus("idle");
      setError(null);
    }
    window.addEventListener(FLIGHT_DESK_RESEARCH_EVENT, onResearch);
    return () => window.removeEventListener(FLIGHT_DESK_RESEARCH_EVENT, onResearch);
  }, []);

  async function research() {
    if (!origin || !destination || !regime) return;
    setStatus("loading");
    setError(null);
    try {
      const response = await fetch("/api/intelligence/passenger-rights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin,
          destination,
          regime,
          disruption: cancelled ? "cancelled" : "delayed",
        }),
      });
      const payload = (await response.json()) as ResearchResult & { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Could not research official sources.");
      setResult(payload);
      setStatus("idle");
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Could not research official sources.");
    }
  }

  useEffect(() => {
    if (!autoRun || !canRun || result || status === "loading") return;
    void research();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auto-run once per route/regime unlock
  }, [autoRun, canRun, origin, destination, regime]);

  return (
    <section id="agent-evidence" className="desk-card overflow-hidden" aria-labelledby="evidence-heading">
      <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] p-5">
        <div>
          <p className="text-[11px] font-extrabold tracking-[0.15em] text-[var(--blue)]">LIVE EVIDENCE</p>
          <h2 id="evidence-heading" className="mt-1 font-display text-2xl italic">
            Official sources, attached
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            Exa searches only government domains for {regime ?? "the applicable regime"}. The briefing explains the
            law; deterministic code still owns the euros.
          </p>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-[10px] font-extrabold"
          style={{
            background: researchLive ? "rgba(199, 240, 75, 0.25)" : "#eef1ff",
            color: researchLive ? "#172000" : "var(--blue)",
          }}
        >
          {researchLive ? "EXA LIVE" : "EXA OFF"}
        </span>
      </div>

      <div className="p-5">
        {!researchLive ? (
          <div className="rounded-xl border border-dashed border-[var(--line)] bg-[#f8f9f6] p-4">
            <p className="text-sm font-bold">Official research needs EXA_API_KEY</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
              Rights math still works. Citations light up when Exa is configured.
            </p>
          </div>
        ) : !result ? (
          <div className="rounded-xl border border-dashed border-[var(--line)] bg-[#f8f9f6] p-4">
            <p className="text-sm font-bold">
              {origin && destination ? `${origin} → ${destination}` : "Inspect a route first"}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
              {status === "loading"
                ? "Pulling official sources and grounding a briefing…"
                : "Retrieval is read-only, citation-preserving, and never files a claim."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {result.briefing ? (
              <div className="rounded-xl bg-[var(--night)] p-4 text-white">
                <p className="text-[10px] font-extrabold tracking-[0.14em] text-[var(--lime)]">GROUNDED BRIEFING</p>
                <p className="mt-2 text-sm leading-relaxed">{result.briefing.briefing}</p>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-wide text-white/45">Compensation</dt>
                    <dd className="mt-1 text-xs leading-relaxed text-white/80">{result.briefing.compensationNotes}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-wide text-white/45">Care</dt>
                    <dd className="mt-1 text-xs leading-relaxed text-white/80">{result.briefing.careNotes}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-wide text-white/45">Exceptions</dt>
                    <dd className="mt-1 text-xs leading-relaxed text-white/80">{result.briefing.exceptions}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-wide text-white/45">Deadline</dt>
                    <dd className="mt-1 text-xs leading-relaxed text-white/80">{result.briefing.claimDeadline}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-[10px] font-bold text-white/40">
                  Not used for money arithmetic · {result.sources.length} official sources
                </p>
              </div>
            ) : null}

            {result.sources.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No matching official source was returned. No evidence invented.</p>
            ) : (
              <ol className="space-y-3">
                {result.sources.slice(0, 5).map((source, index) => (
                  <li key={source.url} className="rounded-xl border border-[var(--line)] bg-white p-4">
                    <div className="flex gap-3">
                      <span className="font-mono text-xs font-bold text-[var(--blue)]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold leading-snug text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4"
                        >
                          {source.title}
                        </a>
                        <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-[var(--muted)]">
                          {source.highlights[0] ?? "Source returned without an excerpt."}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {error ? (
          <p className="mt-3 text-sm font-semibold text-[var(--red)]" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          className="desk-btn desk-btn-solid mt-4 w-full"
          disabled={!canRun || status === "loading"}
          onClick={() => void research()}
        >
          {status === "loading" ? "Searching official sources…" : result ? "Refresh evidence" : "Research this right"}
        </button>
      </div>
    </section>
  );
}
