"use client";

import { useState } from "react";
import Link from "next/link";
import { ElectroMartWebMcp } from "@/components/webmcp/ElectroMartWebMcp";
import { formatEuro } from "@/lib/utils";

interface Order {
  orderId: string;
  lastName: string;
  productName: string;
  purchasedAt: string;
  warrantyMonths: number;
  purchasePrice: string;
  currency: string;
  returnOpened: boolean;
}

interface Claim {
  id: string;
  amount: string;
  status: string;
}

interface Warranty {
  inWarranty: boolean;
  warrantyEndsAt: string;
}

export default function ElectroMartPage() {
  const [orderId, setOrderId] = useState("");
  const [lastName, setLastName] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [claim, setClaim] = useState<Claim | null>(null);
  const [warranty, setWarranty] = useState<Warranty | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function lookup(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setOrder(null);
    setClaim(null);
    setWarranty(null);
    try {
      const response = await fetch("/api/providers/electromart?tool=get_order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, lastName }),
      });
      const payload = (await response.json()) as {
        order?: Order;
        error?: { message?: string };
      };
      if (!response.ok || !payload.order) {
        setError(payload.error?.message ?? "No order matched.");
        return;
      }
      setOrder(payload.order);

      const [claimRes, warrantyRes] = await Promise.all([
        fetch("/api/providers/electromart?tool=get_case_status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
        }),
        fetch("/api/providers/electromart?tool=get_warranty", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, lastName }),
        }),
      ]);
      const claimJson = (await claimRes.json()) as { claim?: Claim | null };
      const warrantyJson = (await warrantyRes.json()) as { warranty?: Warranty };
      setClaim(claimJson.claim ?? null);
      setWarranty(warrantyJson.warranty ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#1c1408] text-[#f3ead8]">
      <div className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-amber-300">
              Simulated retail sandbox
            </p>
            <p className="font-display text-3xl italic">ElectroMart</p>
          </div>
          <Link href="/inbox" className="text-xs uppercase tracking-[0.16em] text-white/60">
            Back to Aegis
          </Link>
        </div>
      </div>

      <div className="mx-auto grid max-w-5xl gap-10 px-6 py-12 lg:grid-cols-[1.1fr_0.9fr]">
        <section>
          <h1 className="font-display text-5xl italic leading-tight">Order desk</h1>
          <p className="mt-4 max-w-md text-white/70">
            Look up a purchase the way a warranty counter would. An expired window does not pay.
            Wrong last name returns nothing.
          </p>

          <form onSubmit={lookup} className="mt-8 space-y-4 border border-white/15 p-5">
            <label className="block text-sm">
              Order id
              <input
                value={orderId}
                onChange={(event) => setOrderId(event.target.value.toUpperCase())}
                className="mt-1 w-full border border-white/20 bg-transparent px-3 py-2 font-mono uppercase"
                required
                minLength={3}
              />
            </label>
            <label className="block text-sm">
              Last name
              <input
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                className="mt-1 w-full border border-white/20 bg-transparent px-3 py-2"
                required
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="bg-[#f3ead8] px-4 py-2 text-sm font-medium text-[#1c1408]"
            >
              {pending ? "Searching…" : "Find order"}
            </button>
            {error ? <p className="text-sm text-red-300">{error}</p> : null}
          </form>

          <div className="mt-6">
            <ElectroMartWebMcp />
          </div>
        </section>

        <section className="border border-white/15 bg-[#2a1d0c] p-6">
          {!order ? (
            <p className="text-sm text-white/60">
              No record on the desk. Try EM-4412 / MOREAU. Failures: EM-5500 warranty expired,
              EM-6600 already claimed.
            </p>
          ) : (
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt>Product</dt>
                <dd>{order.productName}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Purchase price</dt>
                <dd className="font-display text-2xl">{formatEuro(order.purchasePrice)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Warranty</dt>
                <dd>
                  {warranty?.inWarranty ? "inside window" : "expired"} · {order.warrantyMonths} mo
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>Return</dt>
                <dd>{order.returnOpened ? "open" : "unused"}</dd>
              </div>
              <div className="flex justify-between border-t border-white/15 pt-3">
                <dt>Claim on file</dt>
                <dd>{claim ? `${claim.status} · ${formatEuro(claim.amount)}` : "none"}</dd>
              </div>
            </dl>
          )}
        </section>
      </div>
    </main>
  );
}
