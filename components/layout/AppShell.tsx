"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/inbox", label: "Inbox", index: "01" },
  { href: "/cases", label: "Files", index: "02" },
  { href: "/counters", label: "Counters", index: "03" },
  { href: "/settings", label: "Autonomy", index: "04" },
];

export function AppShell({
  children,
  title,
  subtitle,
  actions,
  fileNo,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  fileNo?: string;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-[1400px] gap-0 px-3 py-4 sm:px-6 lg:px-8">
        <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-[13.5rem] shrink-0 flex-col border border-foreground/15 bg-[#dfe6df] md:flex">
          <Link href="/" className="border-b border-foreground/15 px-4 py-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-primary">
              Bureau
            </p>
            <p className="mt-1 font-display text-3xl italic leading-none tracking-tight">Aegis</p>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Consumer case files. Not a chatbot.
            </p>
          </Link>

          <nav className="flex flex-1 flex-col" aria-label="Primary">
            {nav.map((item) => {
              const active =
                pathname === item.href ||
                (item.href === "/cases" && pathname.startsWith("/cases")) ||
                (item.href === "/counters" && pathname.startsWith("/providers"));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-baseline justify-between border-b border-foreground/10 px-4 py-3 text-sm transition-colors",
                    active
                      ? "bg-foreground text-background"
                      : "text-foreground/80 hover:bg-white/50",
                  )}
                >
                  <span>{item.label}</span>
                  <span className="font-mono text-[10px] opacity-70">{item.index}</span>
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-foreground/15 px-4 py-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Rule
            </p>
            <p className="mt-2 text-xs leading-relaxed text-foreground/80">
              The model proposes. Software calculates money. You authorize. The carrier is
              re-read before anything is called done.
            </p>
          </div>
        </aside>

        <div className="relative min-w-0 flex-1 border border-l-0 border-foreground/15 bg-[#f4f6f2] shadow-[12px_16px_0_rgba(20,28,24,0.06)]">
          <div
            aria-hidden
            className="pointer-events-none absolute right-0 top-0 h-16 w-16 border-l border-b border-foreground/10 bg-[#d7ddd6]"
            style={{ clipPath: "polygon(100% 0, 0 0, 100% 100%)" }}
          />

          <header className="flex flex-col gap-4 border-b border-foreground/15 px-5 py-6 sm:flex-row sm:items-end sm:justify-between sm:px-8">
            <div className="space-y-2">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">
                {fileNo ? `File ${fileNo}` : "Aegis bureau"}
              </p>
              <h1 className="max-w-3xl font-display text-4xl font-medium italic leading-[1.05] tracking-tight sm:text-5xl">
                {title}
              </h1>
              {subtitle ? (
                <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {subtitle}
                </p>
              ) : null}
            </div>
            {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
          </header>

          <nav className="flex gap-0 overflow-x-auto border-b border-foreground/10 md:hidden" aria-label="Mobile">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap px-3 py-2 font-mono text-[11px] uppercase tracking-wide"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="px-5 py-6 sm:px-8 sm:py-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
