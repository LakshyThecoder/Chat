"use client";

import { useState } from "react";
import Link from "next/link";
import { StreamlyWebMcp } from "@/components/webmcp/StreamlyWebMcp";
import { formatEuro } from "@/lib/utils";

interface Subscription {
  subscriptionId: string;
  accountEmail: string;
  planName: string;
  monthlyPrice: string;
  status: string;
  cancelledAt: string | null;
  lastChargedAt: string;
  lastChargeAmount: string;
  currency: string;
}

interface Refund {
  id: string;
  amount: string;
  status: string;
}

export default function StreamlyPage() {
  const [subscriptionId, setSubscriptionId] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [refund, setRefund] = useState<Refund | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function lookup(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSubscription(null);
    setRefund(null);
    setOutcome(null);
    try {
      const response = await fetch("/api/providers/streamly?tool=get_subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId, accountEmail }),
      });
      const payload = (await response.json()) as {
        subscription?: Subscription;
        error?: { message?: string };
      };
      if (!response.ok || !payload.subscription) {
        setError(payload.error?.message ?? "No subscription matched.");
        return;
      }
      setSubscription(payload.subscription);

      const [refundRes, calcRes] = await Promise.all([
        fetch("/api/providers/streamly?tool=get_case_status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscriptionId }),
        }),
        fetch("/api/providers/streamly?tool=get_billing_history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscriptionId, accountEmail }),
        }),
      ]);
      const refundJson = (await refundRes.json()) as { refund?: Refund | null };
      const calcJson = (await calcRes.json()) as {
        billing?: { lastChargeAmount: string };
      };
      setRefund(refundJson.refund ?? null);
      setOutcome(
        payload.subscription.status === "cancelled"
          ? `Last charge ${formatEuro(calcJson.billing?.lastChargeAmount ?? payload.subscription.lastChargeAmount)}`
          : "Active plan — billed-after-cancel does not apply",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#1a0e18] text-[#f6e9f2]">
      <div className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-fuchsia-300">
              Simulated billing sandbox
            </p>
            <p className="font-display text-3xl italic">Streamly</p>
          </div>
          <Link href="/inbox" className="text-xs uppercase tracking-[0.16em] text-white/60">
            Back to Aegis
          </Link>
        </div>
      </div>

      <div className="mx-auto grid max-w-5xl gap-10 px-6 py-12 lg:grid-cols-[1.1fr_0.9fr]">
        <section>
          <h1 className="font-display text-5xl italic leading-tight">Member billing</h1>
          <p className="mt-4 max-w-md text-white/70">
            Look up a subscription the way a billing desk would. An active plan does not become a
            refund. Wrong email returns nothing.
          </p>

          <form onSubmit={lookup} className="mt-8 space-y-4 border border-white/15 p-5">
            <label className="block text-sm">
              Subscription id
              <input
                value={subscriptionId}
                onChange={(event) => setSubscriptionId(event.target.value.toUpperCase())}
                className="mt-1 w-full border border-white/20 bg-transparent px-3 py-2 font-mono uppercase"
                required
                minLength={3}
              />
            </label>
            <label className="block text-sm">
              Account email
              <input
                type="email"
                value={accountEmail}
                onChange={(event) => setAccountEmail(event.target.value)}
                className="mt-1 w-full border border-white/20 bg-transparent px-3 py-2"
                required
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="bg-[#f6e9f2] px-4 py-2 text-sm font-medium text-[#1a0e18]"
            >
              {pending ? "Searching…" : "Find subscription"}
            </button>
            {error ? <p className="text-sm text-red-300">{error}</p> : null}
          </form>

          <div className="mt-6">
            <StreamlyWebMcp />
          </div>
        </section>

        <section className="border border-white/15 bg-[#2a1526] p-6">
          {!subscription ? (
            <p className="text-sm text-white/60">
              No record on the desk. Try SL-1001 / camille.moreau@example.com. Failures: SL-2002
              still active, SL-3003 already refunded.
            </p>
          ) : (
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt>Plan</dt>
                <dd>{subscription.planName}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Status</dt>
                <dd>{subscription.status}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Last charge</dt>
                <dd className="font-display text-2xl">{formatEuro(subscription.lastChargeAmount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Desk note</dt>
                <dd>{outcome ?? "—"}</dd>
              </div>
              <div className="flex justify-between border-t border-white/15 pt-3">
                <dt>Refund on file</dt>
                <dd>{refund ? `${refund.status} · ${formatEuro(refund.amount)}` : "none"}</dd>
              </div>
            </dl>
          )}
        </section>
      </div>
    </main>
  );
}
