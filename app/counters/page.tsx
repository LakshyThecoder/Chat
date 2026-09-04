import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { PROVIDER_CATALOG } from "@/src/domain/providers/catalog";

const COUNTERS = [PROVIDER_CATALOG.flyright];

export default function CountersPage() {
  return (
    <AppShell
      title="Counters"
      subtitle="Labeled sandboxes. Each one looks up a real persisted record and mutates it only through WebMCP tools."
    >
      <ul className="grid gap-4 md:grid-cols-3">
        {COUNTERS.map((counter) => (
          <li key={counter.id}>
            <Link
              href={counter.href ?? "/counters"}
              className="block h-full border border-foreground/15 bg-white p-5 transition-colors hover:bg-[#e7eee4]"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
                {counter.sandboxLabel}
              </p>
              <h2 className="mt-2 font-display text-3xl italic">{counter.name}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{counter.kind}</p>
              <p className="mt-4 text-sm">Lookup: {counter.identity}</p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                HIGH_IMPACT · {counter.highImpactTool}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
