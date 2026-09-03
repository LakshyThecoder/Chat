"use client";

import { useState } from "react";
import Link from "next/link";
import { FlyRightWebMcp } from "@/components/webmcp/FlyRightWebMcp";
import { formatEuro } from "@/lib/utils";

interface Booking {
  locator: string;
  lastName: string;
  passengerFirstName: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureAt: string;
  farePaid: string;
  currency: string;
  flightStatus: string;
  cancelledByCarrier: boolean;
  ticketUnused: boolean;
}

interface Claim {
  id: string;
  amount: string;
  status: string;
}

export default function FlyRightPage() {
  const [locator, setLocator] = useState("");
  const [lastName, setLastName] = useState("");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [claim, setClaim] = useState<Claim | null>(null);
  const [compensation, setCompensation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function lookup(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setBooking(null);
    setClaim(null);
    setCompensation(null);
    try {
      const response = await fetch("/api/providers/flyright?tool=get_booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locator, lastName }),
      });
      const payload = (await response.json()) as {
        booking?: Booking;
        error?: { message?: string };
      };
      if (!response.ok || !payload.booking) {
        setError(payload.error?.message ?? "No booking matched.");
        return;
      }
      setBooking(payload.booking);

      const [compRes, claimRes] = await Promise.all([
        fetch("/api/providers/flyright?tool=calculate_compensation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locator, lastName }),
        }),
        fetch("/api/providers/flyright?tool=get_claim_status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locator }),
        }),
      ]);
      const compJson = (await compRes.json()) as {
        compensation?: { amount: string | null; outcome: string };
      };
      const claimJson = (await claimRes.json()) as { claim?: Claim | null };
      setCompensation(
        compJson.compensation?.amount
          ? `${compJson.compensation.outcome}: ${formatEuro(compJson.compensation.amount)}`
          : compJson.compensation?.outcome ?? null,
      );
      setClaim(claimJson.claim ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#07111f] text-[#e7eef8]">
      <div className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-red-400">
              Simulated carrier sandbox
            </p>
            <p className="font-display text-3xl italic">FlyRight</p>
          </div>
          <Link href="/inbox" className="text-xs uppercase tracking-[0.16em] text-white/60">
            Back to Aegis
          </Link>
        </div>
      </div>

      <div className="mx-auto grid max-w-5xl gap-10 px-6 py-12 lg:grid-cols-[1.1fr_0.9fr]">
        <section>
          <h1 className="font-display text-5xl italic leading-tight">Manage booking</h1>
          <p className="mt-4 max-w-md text-white/70">
            Look up a passenger record the way an airline desk would. There is no automatic win.
            Wrong last name returns nothing.
          </p>

          <form onSubmit={lookup} className="mt-8 space-y-4 border border-white/15 p-5">
            <label className="block text-sm">
              Locator
              <input
                value={locator}
                onChange={(event) => setLocator(event.target.value.toUpperCase())}
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
              className="bg-[#e7eef8] px-4 py-2 text-sm font-medium text-[#07111f]"
            >
              {pending ? "Searching…" : "Find booking"}
            </button>
            {error ? <p className="text-sm text-red-300">{error}</p> : null}
          </form>

          <div className="mt-6">
            <FlyRightWebMcp />
          </div>
        </section>

        <section className="border border-white/15 bg-[#0c1c36] p-6">
          {!booking ? (
            <p className="text-sm text-white/60">
              No record on the desk. Search with locator and last name.
            </p>
          ) : (
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt>Passenger</dt>
                <dd>
                  {booking.passengerFirstName} {booking.lastName}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>Flight</dt>
                <dd className="font-mono">
                  {booking.flightNumber} {booking.origin}→{booking.destination}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>Status</dt>
                <dd>{booking.flightStatus}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Fare paid</dt>
                <dd className="font-display text-2xl">{formatEuro(booking.farePaid)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Policy result</dt>
                <dd>{compensation ?? "—"}</dd>
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