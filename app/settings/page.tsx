"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface Policy {
  investigate_allowed: boolean;
  prepare_allowed: boolean;
  high_impact_ask_above_cents: number;
  kill_switch: boolean;
}

export default function SettingsPage() {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/settings/autonomy")
      .then((response) => response.json())
      .then((payload: { policy?: Policy; error?: { message?: string } }) => {
        if (payload.policy) {
          setPolicy(payload.policy);
        } else {
          setMessage(payload.error?.message ?? "Sign in to edit autonomy.");
        }
      });
  }, []);

  async function save() {
    if (!policy) {
      return;
    }
    const response = await fetch("/api/settings/autonomy", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(policy),
    });
    setMessage(response.ok ? "Saved. Enforced on the server." : "Could not save.");
  }

  return (
    <AppShell
      title="Autonomy"
      subtitle="Thresholds live in the database. The browser cannot grant a forbidden submit."
    >
      {!policy ? (
        <p className="text-sm text-muted-foreground">{message ?? "Loading…"}</p>
      ) : (
        <form
          className="max-w-lg space-y-5 border border-foreground/15 bg-white p-6"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label className="flex items-center justify-between gap-4 text-sm">
            Investigate
            <input
              type="checkbox"
              checked={policy.investigate_allowed}
              onChange={(event) =>
                setPolicy({ ...policy, investigate_allowed: event.target.checked })
              }
            />
          </label>
          <label className="flex items-center justify-between gap-4 text-sm">
            Prepare claims
            <input
              type="checkbox"
              checked={policy.prepare_allowed}
              onChange={(event) =>
                setPolicy({ ...policy, prepare_allowed: event.target.checked })
              }
            />
          </label>
          <div className="space-y-2">
            <Label htmlFor="threshold">Ask before submitting above (cents)</Label>
            <input
              id="threshold"
              type="number"
              min={0}
              className="flex h-9 w-full border border-input px-3 font-mono text-sm"
              value={policy.high_impact_ask_above_cents}
              onChange={(event) =>
                setPolicy({
                  ...policy,
                  high_impact_ask_above_cents: Number(event.target.value),
                })
              }
            />
            <p className="text-xs text-muted-foreground">Default 10000 = €100.00</p>
          </div>
          <label className="flex items-center justify-between gap-4 text-sm">
            Kill switch
            <input
              type="checkbox"
              checked={policy.kill_switch}
              onChange={(event) => setPolicy({ ...policy, kill_switch: event.target.checked })}
            />
          </label>
          <Button type="submit">Save policy</Button>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        </form>
      )}
    </AppShell>
  );
}