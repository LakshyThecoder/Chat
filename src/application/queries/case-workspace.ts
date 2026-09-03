import type { SupabaseClient } from "@supabase/supabase-js";
import { getCase } from "@/src/application/queries/cases";
import { listCaseDocuments, type DocumentRecord } from "@/src/application/commands/upload-document";
import type { CaseRecord, CaseEventRecord, CaseRepository } from "@/src/domain/cases/types";
import { resolveProviderId } from "@/src/domain/providers/catalog";
import { createFlyRightProvider } from "@/src/infrastructure/providers/flyright/service";
import { createStreamlyProvider } from "@/src/infrastructure/providers/streamly/service";
import { createElectroMartProvider } from "@/src/infrastructure/providers/electromart/service";

export interface EvidenceFactRecord {
  id: string;
  factKey: string;
  factValue: string;
  confidence: string | null;
  provenance: Record<string, unknown>;
  createdAt: string;
}

export interface EligibilityRecord {
  id: string;
  outcome: "eligible" | "ineligible" | "uncertain";
  amount: string | null;
  currency: string;
  ruleIds: string[];
  reasons: string[];
  inputs: Record<string, unknown>;
  createdAt: string;
}

export interface ActionIntentRecord {
  id: string;
  toolName: string;
  riskClass: string;
  status: string;
  payload: Record<string, unknown>;
  amount: string | null;
  currency: string;
  idempotencyKey: string;
  createdAt: string;
}

export interface VerificationRecord {
  id: string;
  expected: Record<string, unknown>;
  observed: Record<string, unknown>;
  matched: boolean;
  createdAt: string;
}

export interface ProviderMutationRecord {
  provider: string;
  id: string;
  status: string;
  amount: string | null;
  reference: string;
}

export interface CaseWorkspace {
  caseRecord: CaseRecord;
  events: CaseEventRecord[];
  documents: DocumentRecord[];
  facts: EvidenceFactRecord[];
  eligibility: EligibilityRecord | null;
  action: ActionIntentRecord | null;
  verification: VerificationRecord | null;
  providerMutation: ProviderMutationRecord | null;
}

export async function getCaseWorkspace(params: {
  repository: CaseRepository;
  client: SupabaseClient;
  userId: string;
  caseId: string;
}): Promise<CaseWorkspace> {
  const caseRecord = await getCase(params.repository, params.userId, params.caseId);
  const events = await params.repository.listEvents(params.caseId, params.userId);
  const documents = await listCaseDocuments({
    client: params.client,
    userId: params.userId,
    caseId: params.caseId,
  });

  const [{ data: facts }, { data: eligibilityRows }, { data: actionRows }, { data: verificationRows }] =
    await Promise.all([
      params.client
        .from("evidence_facts")
        .select("*")
        .eq("case_id", params.caseId)
        .eq("user_id", params.userId)
        .order("created_at", { ascending: true }),
      params.client
        .from("eligibility_decisions")
        .select("*")
        .eq("case_id", params.caseId)
        .eq("user_id", params.userId)
        .order("created_at", { ascending: false })
        .limit(1),
      params.client
        .from("action_intents")
        .select("*")
        .eq("case_id", params.caseId)
        .eq("user_id", params.userId)
        .order("created_at", { ascending: false })
        .limit(1),
      params.client
        .from("verifications")
        .select("*")
        .eq("case_id", params.caseId)
        .eq("user_id", params.userId)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

  let providerMutation: ProviderMutationRecord | null = null;
  if (caseRecord.bookingLocator) {
    const providerId = resolveProviderId(caseRecord.provider);
    try {
      if (providerId === "streamly") {
        const refund = await createStreamlyProvider().getRefundForSubscription(caseRecord.bookingLocator);
        providerMutation = refund
          ? {
              provider: "streamly",
              id: refund.id,
              status: refund.status,
              amount: refund.amount,
              reference: refund.subscriptionId,
            }
          : null;
      } else if (providerId === "electromart") {
        const claim = await createElectroMartProvider().getClaimForOrder(caseRecord.bookingLocator);
        providerMutation = claim
          ? {
              provider: "electromart",
              id: claim.id,
              status: claim.status,
              amount: claim.amount,
              reference: claim.orderId,
            }
          : null;
      } else if (providerId === "flyright") {
        const claim = await createFlyRightProvider().getClaimForBooking(caseRecord.bookingLocator);
        providerMutation = claim
          ? {
              provider: "flyright",
              id: claim.id,
              status: claim.status,
              amount: claim.amount,
              reference: claim.locator,
            }
          : null;
      }
    } catch {
      providerMutation = null;
    }
  }

  const eligibility = eligibilityRows?.[0]
    ? {
        id: String(eligibilityRows[0].id),
        outcome: eligibilityRows[0].outcome as EligibilityRecord["outcome"],
        amount: eligibilityRows[0].amount ? String(eligibilityRows[0].amount) : null,
        currency: String(eligibilityRows[0].currency),
        ruleIds: (eligibilityRows[0].rule_ids as string[]) ?? [],
        reasons: (eligibilityRows[0].reasons as string[]) ?? [],
        inputs: (eligibilityRows[0].inputs as Record<string, unknown>) ?? {},
        createdAt: String(eligibilityRows[0].created_at),
      }
    : null;

  const action = actionRows?.[0]
    ? {
        id: String(actionRows[0].id),
        toolName: String(actionRows[0].tool_name),
        riskClass: String(actionRows[0].risk_class),
        status: String(actionRows[0].status),
        payload: (actionRows[0].payload as Record<string, unknown>) ?? {},
        amount: actionRows[0].amount ? String(actionRows[0].amount) : null,
        currency: String(actionRows[0].currency),
        idempotencyKey: String(actionRows[0].idempotency_key),
        createdAt: String(actionRows[0].created_at),
      }
    : null;

  const verification = verificationRows?.[0]
    ? {
        id: String(verificationRows[0].id),
        expected: (verificationRows[0].expected as Record<string, unknown>) ?? {},
        observed: (verificationRows[0].observed as Record<string, unknown>) ?? {},
        matched: Boolean(verificationRows[0].matched),
        createdAt: String(verificationRows[0].created_at),
      }
    : null;

  return {
    caseRecord,
    events,
    documents,
    facts: (facts ?? []).map((row) => ({
      id: String(row.id),
      factKey: String(row.fact_key),
      factValue: String(row.fact_value),
      confidence: row.confidence === null || row.confidence === undefined ? null : String(row.confidence),
      provenance: (row.provenance as Record<string, unknown>) ?? {},
      createdAt: String(row.created_at),
    })),
    eligibility,
    action,
    verification,
    providerMutation,
  };
}
