import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#111814] text-[#e7eee8]">
      <div className="mx-auto grid min-h-screen max-w-6xl lg:grid-cols-[1.1fr_0.9fr]">
        <section className="flex flex-col justify-between px-6 py-10 sm:px-12 sm:py-16">
          <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-teal-200/80">
            Bureau of consumer recovery
          </p>
          <div className="max-w-xl">
            <h1 className="font-display text-6xl italic leading-[0.92] tracking-tight sm:text-8xl">
              The file, not the chat.
            </h1>
            <p className="mt-8 max-w-md text-base leading-relaxed text-white/70 sm:text-lg">
              Aegis turns a messy consumer problem into evidence, a calculated amount, a human
              signature, and a verified WebMCP mutation. Mail is the front door. FlyRight, Streamly
              and ElectroMart are labeled counters. Nothing is pre-won.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                href="/inbox"
                className="bg-[#e7eee8] px-5 py-3 text-sm font-medium text-[#111814]"
              >
                Open inbox
              </Link>
              <Link
                href="/counters"
                className="border border-white/25 px-5 py-3 text-sm"
              >
                Sandbox counters
              </Link>
            </div>
          </div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/40">
            Ask · Execute · Verify
          </p>
        </section>

        <section className="border-t border-white/10 bg-[#e6ebe6] text-[#141c18] lg:border-l lg:border-t-0">
          <div className="flex h-full flex-col justify-between p-6 sm:p-10">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">
                How a file actually moves
              </p>
              <ol className="mt-8 space-y-5">
                {[
                  "You connect a sandbox mailbox and open a thread — or fall back to a blank file.",
                  "Software calculates eligibility from that counter’s record and policy. The model never owns the euros.",
                  "If the amount exceeds your autonomy threshold, the file waits for your signature.",
                  "WebMCP writes the mutation. Aegis re-reads the counter before it says verified.",
                ].map((step, index) => (
                  <li key={step} className="grid grid-cols-[2.5rem_1fr] gap-3">
                    <span className="font-mono text-sm text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="text-sm leading-relaxed sm:text-base">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
            <p className="text-sm text-muted-foreground">
              The sandboxes include records that fail: on-time flights, still-active subscriptions,
              expired warranties, and a marketing newsletter. That is the point.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}