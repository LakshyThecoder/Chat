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

interface ResearchResult {
  query: string;
  sources: ResearchSource[];
  providerRequestId: string | null;
}

const SUPPORTED = new Set<RightsRegime>(["EU261", "UK261", "DOT"]);

export function EvidenceResearch({
  origin,
  destination,
  cancelled,
  rights,
}: {
  origin: string | null;
  destination: string | null;
  cancelled: boolean;
  rights: PassengerRightsDecision | null;
}) {
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const regime = useMemo(
    () => rights?.applicableRegimes.find((value) => SUPPORTED.has(value)) ?? null,
    [rights],
  );

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

  return (
    <section id="agent-evidence" className="desk-card overflow-hidden" aria-labelledby="evidence-heading">
      <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] p-5">
        <div>
          <p className="text-[11px] font-extrabold tracking-[0.15em] text-[var(--blue)]">LIVE EVIDENCE</p>
          <h2 id="evidence-heading" className="mt-1 font-display text-2xl italic">
            Official sources, attached
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            Exa searches only the government domains for {regime ?? "the applicable regime"}. Sources explain the
            result; deterministic code still owns the amount.
          </p>
        </div>
        <span className="rounded-full bg-[#eef1ff] px-2.5 py-1 text-[10px] font-extrabold text-[var(--blue)]">
          EXA · OFFICIAL ONLY
        </span>
      </div>

      <div className="p-5">
        {!result ? (
          <div className="rounded-xl border border-dashed border-[var(--line)] bg-[#f8f9f6] p-4">
            <p className="text-sm font-bold">
              {origin && destination ? `${origin} → ${destination}` : "Inspect a route first"}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
              Retrieval is read-only, citation-preserving, and never files a claim.
            </p>
          </div>
        ) : result.sources.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No matching official source was returned. No evidence invented.</p>
        ) : (
          <ol className="space-y-3">
            {result.sources.slice(0, 4).map((source, index) => (
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

        {error ? (
          <p className="mt-3 text-sm font-semibold text-[var(--red)]" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          className="desk-btn desk-btn-solid mt-4 w-full"
          disabled={!origin || !destination || !regime || status === "loading"}
          onClick={() => void research()}
        >
          {status === "loading" ? "Searching official sources…" : result ? "Refresh evidence" : "Research this right"}
        </button>
      </div>
    </section>
  );
}
