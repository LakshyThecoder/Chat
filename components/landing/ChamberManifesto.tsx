"use client";

function scrollToDesk() {
  document.getElementById("desk")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const AUTHORITIES = [
  {
    who: "You",
    verb: "Sign",
    body: "Only a person authorizes money-changing action. The model never grants itself permission.",
  },
  {
    who: "ChatGPT",
    verb: "Operate",
    body: "Works this desktop through WebMCP — begin_resolution, then continue_resolution after you sign.",
  },
  {
    who: "Software",
    verb: "Calculate",
    body: "Entitlement and amounts come from deterministic policy against live rows. Not from the model.",
  },
  {
    who: "Provider",
    verb: "Confirm",
    body: "Success is a re-read of the sandbox claim or refund. Expected must match observed.",
  },
] as const;

const DEMO_BEATS = [
  {
    stamp: "01",
    title: "Go ahead",
    body: "Agent prepares every eligible dispute and stops for UAC. Blocked bookings stay blocked.",
  },
  {
    stamp: "02",
    title: "Unsigned fails",
    body: "File without signature returns APPROVAL_REQUIRED. That is the kernel, not a bug.",
  },
  {
    stamp: "03",
    title: "Continue",
    body: "You sign. continue_resolution files and verifies. Expected vs observed must match.",
  },
] as const;

export function ChamberManifesto() {
  return (
    <section className="chamber-root relative overflow-hidden text-[#f4efe4]" aria-label="What Aegis OS is">
      <a
        href="#desk"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-[#e8b84a] focus:px-3 focus:py-2 focus:text-[#0b1f3a]"
      >
        Skip to Dispute OS desktop
      </a>
      <div className="pointer-events-none absolute inset-0 opacity-[0.35]" aria-hidden>
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-[#e8b84a]/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-[#8a3b12]/20 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-8 sm:pb-20 sm:pt-12">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#e8b84a]/25 pb-6">
          <div>
            <p className="font-board text-xs tracking-[0.34em] text-[#e8b84a]">AEGIS OS · DISPUTE RUNTIME</p>
            <p className="mt-2 max-w-xl text-sm text-white/65">
              An operating system for consumer disputes. Not a chatbot that writes complaints.
            </p>
          </div>
          <button
            type="button"
            onClick={scrollToDesk}
            className="theater-btn bg-[#e8b84a] px-5 py-3 text-sm font-medium text-[#0b1f3a]"
          >
            Boot the desktop
          </button>
        </header>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/45">What it is</p>
            <h1 className="mt-3 max-w-3xl text-balance font-display text-4xl leading-[1.05] text-[#f4efe4] sm:text-5xl lg:text-6xl">
              The shared desktop where{" "}
              <em className="text-[#e8b84a]">you</em> and{" "}
              <em className="text-[#e8b84a]">ChatGPT</em> resolve money disputes.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/75">
              Cancelled flights. Zombie subscriptions. Consumers should not become support specialists. Aegis OS turns a
              messy claim into a permissioned filing on a live WebMCP desktop — then proves the provider row changed.
            </p>

            <div className="mt-8 flex flex-wrap gap-3" aria-hidden>
              <Stamp label="YOU SIGN" tone="paper" rotate="-6deg" />
              <Stamp label="IT FILES" tone="gold" rotate="3deg" />
              <Stamp label="ROW MATCHES" tone="ink" rotate="-2deg" />
            </div>

            <div className="mt-10 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={scrollToDesk}
                className="theater-btn bg-[#e8b84a] px-6 py-3 text-base font-medium text-[#0b1f3a]"
              >
                Enter Dispute OS
              </button>
              <a
                href="#why-webmcp"
                className="theater-btn border border-[#e8b84a]/50 px-6 py-3 text-base text-[#e8b84a]"
              >
                Why WebMCP
              </a>
            </div>
            <p className="mt-4 max-w-xl text-sm text-white/50">
              One URL. Ten tools. Say <span className="font-mono text-[#e8b84a]">Go ahead.</span> — no tool recipe
              required.
            </p>
          </div>

          <aside className="os-window border border-[#e8b84a]/30 bg-[#0b1f3a]/80 p-6 sm:p-7">
            <p className="font-board text-xs tracking-[0.28em] text-[#e8b84a]">SYSTEM STATUS</p>
            <ul className="mt-5 space-y-4">
              <li className="border-b border-white/10 pb-4">
                <p className="font-board text-3xl text-[#e8b84a]">2</p>
                <p className="mt-1 text-sm text-white/70">Eligible dispute processes that can pay after UAC</p>
              </li>
              <li className="border-b border-white/10 pb-4">
                <p className="font-board text-3xl text-[#ffb4a8]">1</p>
                <p className="mt-1 text-sm text-white/70">Blocked process — already claimed, must not file</p>
              </li>
              <li>
                <p className="font-board text-3xl text-[#9dffa1]">10</p>
                <p className="mt-1 text-sm text-white/70">WebMCP tools — including begin_resolution / continue_resolution</p>
              </li>
            </ul>
            <p className="mt-6 font-mono text-[11px] leading-relaxed text-white/40">
              Fake brands. Persisted sandbox rows. No hardcoded success path.
            </p>
          </aside>
        </div>

        <section id="why-webmcp" className="mt-16 scroll-mt-8 border border-[#e8b84a]/20 bg-[#ede6d6] p-6 text-[#1a1714] sm:p-8">
          <p className="font-board text-xs tracking-[0.28em] text-[#8a3b12]">WHY WEBMCP</p>
          <h2 className="mt-3 max-w-3xl font-display text-3xl leading-tight sm:text-4xl">
            A refund is a two-sided job. Scraping a carrier desk — or calling a hidden API the human cannot see —
            breaks that.
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <ManifestCard
              title="Shared desktop"
              body="Tools run in this browser tab and paint the same Task Manager and Inspector you are looking at."
            />
            <ManifestCard
              title="UAC inside the tool"
              body="execute_filing fails with APPROVAL_REQUIRED until you sign. Not a parallel REST bypass."
            />
            <ManifestCard
              title="Kernel verify"
              body="verify_filing re-reads the provider row. Only matched expected vs observed counts as success."
            />
          </div>
        </section>

        <section className="mt-14" aria-labelledby="authority-heading">
          <p className="font-board text-xs tracking-[0.28em] text-[#e8b84a]">PROCESS OWNERS</p>
          <h2 id="authority-heading" className="mt-2 font-display text-3xl sm:text-4xl">
            Authority is divided on purpose.
          </h2>
          <ol className="mt-8 grid gap-3 sm:grid-cols-2">
            {AUTHORITIES.map((item) => (
              <li key={item.who} className="os-window border border-[#e8b84a]/25 bg-[#0b1f3a]/70 p-5">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/40">{item.who}</p>
                <p className="mt-2 font-board text-3xl uppercase tracking-wide text-[#e8b84a]">{item.verb}</p>
                <p className="mt-3 text-sm leading-relaxed text-white/70">{item.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-14" aria-labelledby="beats-heading">
          <p className="font-board text-xs tracking-[0.28em] text-[#e8b84a]">TWO-MINUTE BOOT</p>
          <h2 id="beats-heading" className="mt-2 font-display text-3xl sm:text-4xl">
            What judges should see without narration.
          </h2>
          <ol className="mt-8 grid gap-4 lg:grid-cols-3">
            {DEMO_BEATS.map((beat) => (
              <li key={beat.stamp} className="os-window relative border border-white/15 bg-[#050d18] p-5">
                <span className="font-board text-5xl leading-none text-[#e8b84a]/35">{beat.stamp}</span>
                <p className="mt-3 font-board text-2xl uppercase tracking-wide">{beat.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-white/65">{beat.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-14 border border-[#e8b84a]/35 bg-[#e8b84a] px-6 py-8 text-[#0b1f3a] sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="font-board text-xs tracking-[0.28em]">THE CLAIM</p>
              <p className="mt-2 font-display text-2xl leading-snug sm:text-3xl">
                People and agents share one desktop. The agent cannot file without you. You should not type locators
                into forms. The web, working for you.
              </p>
            </div>
            <button
              type="button"
              onClick={scrollToDesk}
              className="theater-btn shrink-0 bg-[#0b1f3a] px-6 py-4 text-base text-[#e8b84a]"
            >
              Open Dispute OS →
            </button>
          </div>
        </section>
      </div>

      <div className="sticky bottom-0 z-40 border-t border-[#e8b84a]/30 bg-[#071525]/95 px-4 py-3 backdrop-blur sm:hidden">
        <button
          type="button"
          onClick={scrollToDesk}
          className="theater-btn w-full bg-[#e8b84a] px-4 py-3 text-sm font-medium text-[#0b1f3a]"
        >
          Boot the desktop
        </button>
      </div>
    </section>
  );
}

function Stamp({
  label,
  tone,
  rotate,
}: {
  label: string;
  tone: "paper" | "gold" | "ink";
  rotate: string;
}) {
  const tones = {
    paper: "border-[#f4efe4] text-[#f4efe4]",
    gold: "border-[#e8b84a] text-[#e8b84a]",
    ink: "border-[#ffb4a8] text-[#ffb4a8]",
  } as const;
  return (
    <span
      className={`inline-flex border-2 border-dashed px-3 py-2 font-board text-sm tracking-[0.2em] opacity-90 ${tones[tone]}`}
      style={{ transform: `rotate(${rotate})` }}
    >
      {label}
    </span>
  );
}

function ManifestCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-[#1a1714]/15 bg-white/50 p-4">
      <p className="font-board text-xl uppercase tracking-wide text-[#8a3b12]">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-[#5c5348]">{body}</p>
    </div>
  );
}
