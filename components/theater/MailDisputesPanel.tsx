"use client";

import { useCallback, useEffect, useState } from "react";
import { MAIL_DESK_STATE_EVENT, runMailDeskTool } from "@/components/theater/register-mail-desk-tools";
import type { MailDeskSnapshot, MailDeskItemSnapshot } from "@/src/domain/mail-desk/types";
import { formatEuro } from "@/lib/utils";

async function fetchDesk(method: "GET" | "POST") {
  const response = await fetch("/api/demo/mail/session", { method });
  const payload = (await response.json()) as { desk?: MailDeskSnapshot; error?: { message?: string } };
  if (!response.ok || !payload.desk) {
    throw new Error(payload.error?.message ?? "Could not open mail desk.");
  }
  return payload.desk;
}

export function MailDisputesPanel({ active }: { active: boolean }) {
  const [desk, setDesk] = useState<MailDeskSnapshot | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback((next: MailDeskSnapshot, focusId?: string) => {
    setDesk(next);
    setSelectedId((current) => focusId ?? current ?? next.items[0]?.id ?? null);
  }, []);

  async function openDesk(reset = false) {
    setPending(reset ? "reset" : "open");
    setError(null);
    try {
      if (!reset) {
        const response = await fetch("/api/demo/mail/session", { method: "GET" });
        if (response.status === 404 || response.status === 409) {
          apply(await fetchDesk("POST"));
          return;
        }
        const payload = (await response.json()) as { desk?: MailDeskSnapshot; error?: { message?: string } };
        if (!response.ok || !payload.desk) throw new Error(payload.error?.message ?? "Could not open mail desk.");
        apply(payload.desk);
        return;
      }
      apply(await fetchDesk("POST"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open mail desk.");
    } finally {
      setPending(null);
    }
  }

  useEffect(() => {
    void openDesk(false);
    function onState(event: Event) {
      const detail = (event as CustomEvent<MailDeskSnapshot>).detail;
      if (detail) apply(detail);
    }
    window.addEventListener(MAIL_DESK_STATE_EVENT, onState);
    return () => window.removeEventListener(MAIL_DESK_STATE_EVENT, onState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function begin() {
    setPending("begin");
    setError(null);
    try {
      await runMailDeskTool("begin_mail_resolution", {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Begin failed.");
    } finally {
      setPending(null);
    }
  }

  async function decide(itemId: string, decision: "approved" | "denied") {
    setPending(`decide:${decision}`);
    setError(null);
    try {
      const response = await fetch("/api/demo/mail/session/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, decision }),
      });
      const payload = (await response.json()) as { desk?: MailDeskSnapshot; error?: { message?: string } };
      if (!response.ok || !payload.desk) throw new Error(payload.error?.message ?? "Signature failed.");
      apply(payload.desk, itemId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signature failed.");
    } finally {
      setPending(null);
    }
  }

  async function sendAndVerify(itemId: string) {
    setPending("send");
    setError(null);
    try {
      await runMailDeskTool("send_support_email", { itemId });
      await runMailDeskTool("verify_sent", { itemId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed.");
    } finally {
      setPending(null);
    }
  }

  if (!active) return null;

  if (!desk) {
    return (
      <div className="px-4 py-6 text-sm text-white/60" data-agent-target="mail">
        {error ?? (pending ? "Opening mailbox…" : "Mail desk offline.")}
        {error ? (
          <button type="button" className="theater-btn ml-3 text-[#e8b84a]" onClick={() => void openDesk(true)}>
            Retry
          </button>
        ) : null}
      </div>
    );
  }

  const selected = desk.items.find((item) => item.id === selectedId) ?? desk.items[0];
  const awaiting = desk.items.filter((item) => item.status === "AWAITING_SIGNATURE");

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row" data-agent-target="mail">
      <div className="border-b border-white/10 lg:w-[42%] lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          <p className="text-sm text-white/70">Sandbox mailbox · billed-after-cancel</p>
          <button
            type="button"
            className="theater-btn text-[11px] text-[#e8b84a]"
            disabled={Boolean(pending)}
            onClick={() => void openDesk(true)}
          >
            Refresh
          </button>
        </div>
        <ol className="space-y-2 p-4">
          {desk.items.map((item) => (
            <MailRow
              key={item.id}
              item={item}
              active={item.id === selected?.id}
              onSelect={() => setSelectedId(item.id)}
            />
          ))}
        </ol>
        <div className="border-t border-white/10 px-4 py-4">
          <button
            type="button"
            className="theater-btn bg-[#e8b84a] px-3 py-2 text-sm text-[#0b1f3a] disabled:opacity-40"
            disabled={Boolean(pending)}
            onClick={() => void begin()}
          >
            {pending === "begin" ? "Reading mailbox…" : "Begin mail resolution"}
          </button>
          <p className="mt-2 font-mono text-[11px] text-white/40">
            Or tell ChatGPT: check my email for the CodeForge charge and prepare a refund.
          </p>
        </div>
      </div>

      <div className="flex-1 space-y-4 px-4 py-4">
        {selected ? (
          <>
            <div>
              <p className="font-board text-2xl uppercase tracking-wide text-[#e8b84a]">{selected.merchant}</p>
              <p className="mt-1 text-sm text-white/75">{selected.subject}</p>
              <p className="mt-1 font-mono text-[11px] text-white/40">
                {selected.fromAddress} · {selected.status.replaceAll("_", " ")}
              </p>
              <p className="mt-2 text-sm text-white/60">{selected.hint}</p>
            </div>

            {selected.bill ? (
              <div className="border border-[#e8b84a]/30 bg-[#e8b84a]/5 px-3 py-3">
                <p className="font-board text-xs tracking-[0.2em] text-[#e8b84a]">IMPORTED BILL</p>
                <p className="mt-2 font-board text-4xl text-[#e8b84a]">{formatEuro(selected.bill.amount)}</p>
                <p className="mt-1 font-mono text-[11px] text-white/55">
                  {selected.bill.invoiceId} · {selected.bill.planName}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-xs text-white/50">{selected.bill.bodyText}</p>
              </div>
            ) : (
              <p className="theater-empty-desk text-sm text-white/50">No bill imported yet.</p>
            )}

            {selected.policy ? (
              <div className="border border-white/15 px-3 py-3">
                <p className="font-board text-xs tracking-[0.2em] text-white/45">POLICY</p>
                <p className="mt-2 text-sm font-medium text-white">{selected.policy.title}</p>
                <p className="mt-1 text-sm text-white/65">{selected.policy.body}</p>
                <p className="mt-2 font-mono text-[10px] text-white/35">{selected.policy.source}</p>
              </div>
            ) : null}

            {selected.draft ? (
              <div className="border border-white/15 bg-[#050d18] px-3 py-3">
                <p className="font-board text-xs tracking-[0.2em] text-[#e8b84a]">DRAFT → {selected.draft.toAddress}</p>
                <p className="mt-2 text-sm font-medium">{selected.draft.subject}</p>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-xs leading-relaxed text-white/65">
                  {selected.draft.body}
                </pre>
              </div>
            ) : null}

            {awaiting
              .filter((item) => item.id === selected.id)
              .map((item) => (
                <div key={item.id} className="border-2 border-[#e8b84a] bg-[#e8b84a]/10 px-4 py-4 text-[#e8b84a]">
                  <p className="font-board text-xs tracking-[0.22em]">UAC · SIGN OUTBOUND EMAIL</p>
                  <p className="mt-2 font-board text-4xl">{formatEuro(item.draft?.amount)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="theater-btn bg-[#e8b84a] px-3 py-2 text-sm text-[#0b1f3a] disabled:opacity-40"
                      disabled={Boolean(pending)}
                      onClick={() => void decide(item.id, "approved")}
                    >
                      Sign & authorize send
                    </button>
                    <button
                      type="button"
                      className="theater-btn border border-[#e8b84a] px-3 py-2 text-sm disabled:opacity-40"
                      disabled={Boolean(pending)}
                      onClick={() => void decide(item.id, "denied")}
                    >
                      Deny
                    </button>
                  </div>
                </div>
              ))}

            {selected.status === "APPROVED" ? (
              <button
                type="button"
                className="theater-btn border border-[#9dffa1]/50 px-3 py-2 text-sm text-[#9dffa1] disabled:opacity-40"
                disabled={Boolean(pending)}
                onClick={() => void sendAndVerify(selected.id)}
              >
                {pending === "send" ? "Sending…" : "Send signed email + verify"}
              </button>
            ) : null}

            {selected.verification ? (
              <div
                role="status"
                aria-live="assertive"
                className={`border-2 px-4 py-4 ${
                  selected.verification.matched
                    ? "border-[#9dffa1] bg-[#9dffa1]/15 text-[#9dffa1]"
                    : "border-[#ffb4a8] bg-[#ffb4a8]/10 text-[#ffb4a8]"
                }`}
              >
                <p className="font-board text-xs tracking-[0.22em]">
                  {selected.verification.matched ? "VERIFY · SENT MATCHED" : "VERIFY · MISMATCH"}
                </p>
                <p className="mt-2 font-board text-3xl uppercase leading-none tracking-wide">
                  {selected.verification.matched ? "Email on file. Done." : "Do not declare success."}
                </p>
                <p className="mt-3 font-mono text-[11px] text-white/70">
                  to {String(selected.verification.observed.toAddress ?? "—")} ·{" "}
                  {formatEuro(String(selected.verification.observed.amount ?? ""))}
                </p>
              </div>
            ) : null}

            {error && error.includes("APPROVAL_REQUIRED") ? (
              <div className="border-2 border-[#e8b84a] bg-[#e8b84a]/15 px-4 py-4 text-[#e8b84a]" role="alert">
                <p className="font-board text-xs tracking-[0.22em]">UAC DENIED · APPROVAL_REQUIRED</p>
                <p className="mt-2 text-lg font-medium">Unsigned send refused.</p>
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-white/50">No disputes in this mailbox session.</p>
        )}

        {error ? (
          <p className="text-sm text-[#ffb4a8]" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function MailRow({
  item,
  active,
  onSelect,
}: {
  item: MailDeskItemSnapshot;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`theater-btn w-full border px-3 py-3 text-left ${
          active ? "border-[#e8b84a] bg-[#e8b84a]/10" : "border-white/15 bg-white/5 hover:bg-white/10"
        }`}
      >
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-medium text-white">{item.merchant}</p>
          <p className="font-board text-xl text-[#e8b84a]">
            {formatEuro(item.draft?.amount ?? item.bill?.amount)}
          </p>
        </div>
        <p className="mt-1 line-clamp-2 text-xs text-white/55">{item.title}</p>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[#e8b84a]/80">
          {item.status.replaceAll("_", " ")}
        </p>
      </button>
    </li>
  );
}
