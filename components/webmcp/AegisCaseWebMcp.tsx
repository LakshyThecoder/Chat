"use client";

import { useEffect, useState } from "react";

export function AegisCaseWebMcp({ caseId }: { caseId: string }) {
  const [label, setLabel] = useState("Checking WebMCP…");

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) {
      setLabel("WebMCP unavailable in this browser");
      return;
    }

    const jsonGet = async (path: string) => {
      const response = await fetch(path);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error((payload as { error?: { message?: string } }).error?.message ?? "Request failed");
      }
      return payload;
    };

    context.registerTool({
      name: "get_case",
      description: "Read the current Aegis case, eligibility, evidence facts, and verification.",
      inputSchema: { type: "object", additionalProperties: false, properties: {} },
      execute: () => jsonGet(`/api/cases/${caseId}`),
    });

    context.registerTool({
      name: "list_evidence",
      description: "List uploaded evidence documents for this case.",
      inputSchema: { type: "object", additionalProperties: false, properties: {} },
      execute: () => jsonGet(`/api/cases/${caseId}/evidence`),
    });

    context.registerTool({
      name: "get_eligibility",
      description: "Read the latest deterministic eligibility decision. Amount is engine-owned.",
      inputSchema: { type: "object", additionalProperties: false, properties: {} },
      execute: () => jsonGet(`/api/cases/${caseId}`),
    });

    context.registerTool({
      name: "get_approval_status",
      description: "Read whether the proposed carrier submission is waiting for human approval.",
      inputSchema: { type: "object", additionalProperties: false, properties: {} },
      execute: () => jsonGet(`/api/cases/${caseId}`),
    });

    context.registerTool({
      name: "verify_provider_state",
      description: "Read the last verification of provider state for this case.",
      inputSchema: { type: "object", additionalProperties: false, properties: {} },
      execute: () => jsonGet(`/api/cases/${caseId}`),
    });

    setLabel("Agent may inspect and prepare. Submit stays human-gated.");
  }, [caseId]);

  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
  );
}
