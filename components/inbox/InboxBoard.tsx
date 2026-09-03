"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getProviderCatalog } from "@/src/domain/providers/catalog";
import type { MailCatalogMessage } from "@/src/domain/mail/case-draft-from-mail";

export function InboxBoard({
  connected,
  messages,
}: {
  connected: boolean;
  messages: MailCatalogMessage[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openingKey, setOpeningKey] = useState<string | null>(null);

  async function connectMail() {
    setPending("connect");
    setError(null);
    try {
      const response = await fetch("/api/sources/mail", { method: "POST" });
      const payload = (await response.json()) as {
        casesCreated?: number;
        error?: { message?: string };
      };
      if (!response.ok) {
        setError(payload.error?.message ?? "Could not connect the sandbox mailbox.");
        return;
      }
      if (payload.casesCreated && payload.casesCreated > 0) {
        setError("Connect created cases. That must not happen — reload and report this.");
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect.");
    } finally {
      setPending(null);
    }
  }

  async function openThread(messageKey: string) {
    setOpeningKey(messageKey);
    setError(null);
    try {
      const response = await fetch("/api/sources/mail/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageKey }),
      });
      const payload = (await response.json()) as {
        case?: { id: string; amountAtRisk: string | null };
        error?: { message?: string };
      };
      if (!response.ok || !payload.case) {
        setError(payload.error?.message ?? "Could not open that thread.");
        return;
      }
      router.push(`/cases/${payload.case.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open that thread.");
    } finally {
      setOpeningKey(null);
    }
  }

  if (!connected) {
    return (
      <section className="border border-foreground/15 bg-white px-6 py-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">Source</p>
        <h2 className="mt-2 font-display text-4xl italic">The tray is unlatched</h2>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Connect the labeled sandbox mailbox. That writes one connection row for you. It does not
          invent files, eligibility, or refunds. Same honesty as a Stripe test card.
        </p>
        <Button className="mt-6" type="button" onClick={connectMail} disabled={Boolean(pending)}>
          {pending === "connect" ? "Connecting…" : "Connect sandbox mailbox"}
        </Button>
        {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4 border border-foreground/15 bg-[#e7eee4] px-5 py-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
            Sandbox mailbox · not Gmail
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {messages.length} threads in the catalog, including ones that should not pay out.
          </p>
        </div>
        <p className="font-mono text-[11px] text-muted-foreground">Connected</p>
      </section>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {messages.length === 0 ? (
        <p className="border border-dashed border-foreground/20 bg-white px-5 py-10 text-sm text-muted-foreground">
          Catalog is empty. That is a data problem, not a win.
        </p>
      ) : (
        <ul className="border border-foreground/15 bg-white">
          {messages.map((message) => {
            const counter = getProviderCatalog(message.routeProvider);
            return (
              <li
                key={message.messageKey}
                className="grid gap-4 border-b border-foreground/10 px-5 py-5 last:border-0 lg:grid-cols-[1fr_auto]"
              >
                <div>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <p className="font-medium">{message.subject}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {new Date(message.sentAt).toLocaleString()}
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {message.fromName} · {message.fromAddress}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed">{message.hint}</p>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    {counter.href ? `${counter.name} · ${counter.kind}` : "No counter"}
                  </p>
                </div>
                <div className="flex items-start">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={Boolean(openingKey)}
                    onClick={() => openThread(message.messageKey)}
                  >
                    {openingKey === message.messageKey ? "Opening…" : "Open as a case"}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
