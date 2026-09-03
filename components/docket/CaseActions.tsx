"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function CaseActions({
  caseId,
  canInvestigate,
  canApprove,
  canExecute,
  canSync,
}: {
  caseId: string;
  canInvestigate: boolean;
  canApprove: boolean;
  canExecute: boolean;
  canSync: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function post(path: string, body?: unknown) {
    setPending(path);
    setError(null);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        setError(payload.error?.message ?? "Request failed");
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {canInvestigate ? (
          <Button
            type="button"
            disabled={Boolean(pending)}
            onClick={() => post(`/api/cases/${caseId}/investigate`)}
          >
            {pending?.includes("investigate") ? "Investigating…" : "Run investigation"}
          </Button>
        ) : null}
        {canApprove ? (
          <>
            <Button
              type="button"
              disabled={Boolean(pending)}
              onClick={() => post(`/api/cases/${caseId}/action`, { decision: "approved" })}
            >
              {pending?.includes("action") ? "Working…" : "Approve submission"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={Boolean(pending)}
              onClick={() => post(`/api/cases/${caseId}/action`, { decision: "denied" })}
            >
              Deny
            </Button>
          </>
        ) : null}
        {canExecute ? (
          <Button
            type="button"
            disabled={Boolean(pending)}
            onClick={async () => {
              setPending("execute");
              setError(null);
              const response = await fetch(`/api/cases/${caseId}/action`, { method: "PUT" });
              const payload = (await response.json()) as { error?: { message?: string } };
              if (!response.ok) {
                setError(payload.error?.message ?? "Execute failed");
              }
              setPending(null);
              router.refresh();
            }}
          >
            {pending === "execute" ? "Submitting…" : "Execute approved claim"}
          </Button>
        ) : null}
        {canSync ? (
          <Button
            type="button"
            variant="outline"
            disabled={Boolean(pending)}
            onClick={() => post(`/api/cases/${caseId}/sync`)}
          >
            {pending?.includes("sync") ? "Syncing…" : "Sync counter status"}
          </Button>
        ) : null}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
