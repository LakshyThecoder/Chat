import Link from "next/link";
import { EvidenceUploadForm } from "@/components/evidence/EvidenceUploadForm";
import { CaseActions } from "@/components/docket/CaseActions";
import { AegisCaseWebMcp } from "@/components/webmcp/AegisCaseWebMcp";
import { formatEuro, formatStatus } from "@/lib/utils";
import type { CaseWorkspace, ProviderMutationRecord } from "@/src/application/queries/case-workspace";
import { getProviderCatalog } from "@/src/domain/providers/catalog";
import { CASE_STATUSES } from "@/src/domain/cases/state-machine";

const EVENT_COPY: Record<string, string> = {
  CASE_CREATED: "File opened",
  CASE_STATUS_CHANGED: "Status moved",
  ELIGIBILITY_CALCULATED: "Eligibility calculated",
  ACTION_APPROVED: "Submission approved",
  ACTION_DENIED: "Submission denied",
  CLAIM_VERIFIED: "Provider state verified",
  CLAIM_FAILED: "Provider submission failed",
  PROVIDER_STATUS_SYNCED: "Provider status synced",
};

export function DocketBoard({ workspace }: { workspace: CaseWorkspace }) {
  const { caseRecord, eligibility, action, verification, facts, documents, events, providerMutation } =
    workspace;
  const counter = getProviderCatalog(caseRecord.provider);

  const amountLabel =
    eligibility?.outcome === "eligible" && eligibility.amount
      ? formatEuro(eligibility.amount)
      : "—";
  const amountNote =
    eligibility?.outcome === "eligible"
      ? "potentially recoverable"
      : eligibility?.outcome === "ineligible"
        ? "not recoverable under current policy"
        : eligibility
          ? "uncertain — needs a matching provider record"
          : "no eligibility yet";

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.7fr)_minmax(18rem,0.9fr)]">
      <div className="space-y-8">
        <section className="border border-foreground/15 bg-white px-5 py-6 sm:px-7">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Status
              </p>
              <p className="mt-2 font-display text-3xl italic">{formatStatus(caseRecord.status)}</p>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Next: {caseRecord.nextAction ?? "None"}
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Engine amount
              </p>
              <p className="mt-1 font-display text-5xl leading-none tracking-tight">{amountLabel}</p>
              <p className="mt-2 text-xs text-muted-foreground">{amountNote}</p>
            </div>
          </div>

          <ol className="mt-8 flex flex-wrap gap-1" aria-label="Case spine">
            {CASE_STATUSES.map((status) => {
              const currentIndex = CASE_STATUSES.indexOf(caseRecord.status);
              const index = CASE_STATUSES.indexOf(status);
              const reached = index <= currentIndex;
              return (
                <li
                  key={status}
                  className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-wide ${
                    status === caseRecord.status
                      ? "border-foreground bg-foreground text-background"
                      : reached
                        ? "border-foreground/30 text-foreground"
                        : "border-foreground/10 text-muted-foreground"
                  }`}
                >
                  {formatStatus(status)}
                </li>
              );
            })}
          </ol>
        </section>

        <section className="border border-foreground/15 bg-white">
          <header className="border-b border-foreground/10 px-5 py-4 sm:px-7">
            <h2 className="font-display text-2xl italic">Exhibits</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Files are hashed. Facts appear only after extraction validates.
            </p>
          </header>
          <div className="space-y-4 px-5 py-5 sm:px-7">
            {documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents in this file yet.</p>
            ) : (
              <ul className="space-y-2">
                {documents.map((document, index) => (
                  <li key={document.id} className="flex justify-between gap-3 border-b border-foreground/10 py-2 text-sm">
                    <span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        EX-{String(index + 1).padStart(2, "0")}
                      </span>{" "}
                      {document.filename}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {document.sha256.slice(0, 12)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {facts.length > 0 ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {facts.map((fact) => (
                  <li key={fact.id} className="border border-foreground/10 px-3 py-2">
                    <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                      {fact.factKey}
                    </p>
                    <p className="text-sm">{fact.factValue}</p>
                  </li>
                ))}
              </ul>
            ) : null}
            <EvidenceUploadForm caseId={caseRecord.id} />
          </div>
        </section>

        <section className="border border-foreground/15 bg-white">
          <header className="border-b border-foreground/10 px-5 py-4 sm:px-7">
            <h2 className="font-display text-2xl italic">Eligibility ledger</h2>
          </header>
          <div className="px-5 py-5 sm:px-7">
            {!eligibility ? (
              <p className="text-sm text-muted-foreground">
                Run investigation after a counter lookup or a text exhibit.
              </p>
            ) : (
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4 border-b border-foreground/10 py-2">
                  <dt>Outcome</dt>
                  <dd className="font-medium">{eligibility.outcome}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-foreground/10 py-2">
                  <dt>Amount</dt>
                  <dd className="font-display text-xl">{formatEuro(eligibility.amount)}</dd>
                </div>
                {eligibility.ruleIds.map((rule) => (
                  <div key={rule} className="flex justify-between gap-4 border-b border-foreground/10 py-2">
                    <dt>Rule</dt>
                    <dd className="font-mono text-xs">{rule}</dd>
                  </div>
                ))}
                {eligibility.reasons.map((reason) => (
                  <p key={reason} className="text-muted-foreground">
                    {reason}
                  </p>
                ))}
              </dl>
            )}
          </div>
        </section>

        {action ? (
          <section className="border border-foreground/20 bg-[#111814] text-[#eef3ee]">
            <header className="border-b border-white/10 px-5 py-4 sm:px-7">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal-200/80">
                Authorization
              </p>
              <h2 className="mt-1 font-display text-2xl italic">One-action contract</h2>
            </header>
            <div className="space-y-3 px-5 py-5 text-sm sm:px-7">
              <p>
                Submit <span className="font-mono">{action.toolName}</span> to {counter.name} for{" "}
                {formatEuro(action.amount)}.
              </p>
              <pre className="overflow-x-auto border border-white/10 bg-black/30 p-3 font-mono text-[11px] leading-relaxed">
                {JSON.stringify(action.payload, null, 2)}
              </pre>
              <p className="text-white/70">Intent {action.status.replaceAll("_", " ").toLowerCase()}.</p>
            </div>
          </section>
        ) : null}

        <section className="border border-foreground/15 bg-white">
          <header className="border-b border-foreground/10 px-5 py-4 sm:px-7">
            <h2 className="font-display text-2xl italic">File log</h2>
          </header>
          <ol className="px-5 py-5 sm:px-7">
            {events.map((event) => (
              <li key={event.id} className="grid grid-cols-[7rem_1fr] gap-3 border-b border-foreground/10 py-3 text-sm">
                <span className="font-mono text-[11px] text-muted-foreground">
                  {new Date(event.createdAt).toLocaleString()}
                </span>
                <span>
                  {EVENT_COPY[event.eventType] ?? event.eventType}
                  {event.toStatus ? ` → ${formatStatus(event.toStatus)}` : ""}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <aside className="space-y-6">
        <CounterPanel
          provider={caseRecord.provider}
          locator={caseRecord.bookingLocator}
          accountEmail={caseRecord.accountEmail}
          mutation={providerMutation}
          verificationMatched={verification?.matched ?? null}
        />

        <AegisCaseWebMcp caseId={caseRecord.id} />

        <CaseActions
          caseId={caseRecord.id}
          canInvestigate={["DRAFT", "INVESTIGATING", "READY_FOR_REVIEW", "NEEDS_INFORMATION"].includes(
            caseRecord.status,
          )}
          canApprove={caseRecord.status === "AWAITING_APPROVAL"}
          canExecute={caseRecord.status === "READY_FOR_REVIEW" && action?.status === "PROPOSED"}
          canSync={["SUBMITTED", "UNDER_REVIEW", "NEEDS_INFORMATION"].includes(caseRecord.status)}
        />
      </aside>
    </div>
  );
}

const COUNTER_THEME = {
  flyright: { panel: "bg-[#0b1d3a] text-[#e8eef8]", accent: "text-red-300" },
  streamly: { panel: "bg-[#1a0e18] text-[#f6e9f2]", accent: "text-fuchsia-300" },
  electromart: { panel: "bg-[#1c1408] text-[#f3ead8]", accent: "text-amber-300" },
  unspecified: { panel: "bg-[#1f2420] text-[#e8eee8]", accent: "text-teal-200" },
} as const;

function themeFor(providerId: string) {
  if (providerId === "streamly") {
    return COUNTER_THEME.streamly;
  }
  if (providerId === "electromart") {
    return COUNTER_THEME.electromart;
  }
  if (providerId === "flyright") {
    return COUNTER_THEME.flyright;
  }
  return COUNTER_THEME.unspecified;
}

function CounterPanel({
  provider,
  locator,
  accountEmail,
  mutation,
  verificationMatched,
}: {
  provider: string;
  locator: string | null;
  accountEmail: string | null;
  mutation: ProviderMutationRecord | null;
  verificationMatched: boolean | null;
}) {
  const counter = getProviderCatalog(provider);
  const theme = themeFor(counter.id);

  return (
    <section className={`border border-foreground/15 p-5 ${theme.panel}`}>
      <p className={`font-mono text-[10px] uppercase tracking-[0.22em] ${theme.accent}`}>
        {counter.sandboxLabel}
      </p>
      <h2 className="mt-2 font-display text-3xl italic">{counter.name}</h2>
      <p className="mt-2 text-sm text-white/70">
        {counter.href
          ? "Look up the record at the counter. Aegis does not invent provider state."
          : "This thread has no counter. Investigation should stay uncertain."}
      </p>
      <dl className="mt-5 space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt>Identity</dt>
          <dd className="font-mono">{locator ?? "—"}</dd>
        </div>
        {accountEmail ? (
          <div className="flex justify-between gap-3">
            <dt>Account</dt>
            <dd className="font-mono text-xs">{accountEmail}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-3">
          <dt>On file</dt>
          <dd className="font-mono">{mutation?.id.slice(0, 8) ?? "none"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Provider status</dt>
          <dd>{mutation?.status ?? "—"}</dd>
        </div>
      </dl>
      {verificationMatched === null ? (
        <p className="mt-4 text-sm text-white/60">No verification until a mutation is submitted.</p>
      ) : (
        <p className="mt-4 border-t border-white/15 pt-4 text-sm">
          {verificationMatched
            ? "Verified: observed provider state matches the submission."
            : "Verification mismatch. This file is not marked successful."}
        </p>
      )}
      {counter.href ? (
        <Link
          href={counter.href}
          className="mt-5 inline-block border border-white/30 px-3 py-2 text-xs uppercase tracking-[0.16em]"
        >
          Open counter
        </Link>
      ) : null}
    </section>
  );
}
