"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050d18] px-6 text-[#f4efe4]">
      <div className="max-w-lg border border-[#e8b84a]/40 bg-[#0b1f3a] p-8">
        <p className="font-board text-xs tracking-[0.28em] text-[#e8b84a]">KERNEL PANIC</p>
        <h1 className="mt-3 font-board text-4xl uppercase tracking-wide">Desktop failed to boot</h1>
        <p className="mt-4 text-sm text-white/70" role="alert">
          {error.message || "A client-side exception stopped Aegis OS."}
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-[11px] text-white/40">digest {error.digest}</p>
        ) : null}
        <button
          type="button"
          className="mt-6 bg-[#e8b84a] px-4 py-3 text-sm font-medium text-[#0b1f3a]"
          onClick={() => reset()}
        >
          Reboot desktop
        </button>
      </div>
    </main>
  );
}
