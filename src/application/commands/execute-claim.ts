import type { SupabaseClient } from "@supabase/supabase-js";
import { CaseService } from "@/src/domain/cases/case-service";
import type { CaseRepository } from "@/src/domain/cases/types";
import { parseDecimalToCents } from "@/src/domain/money/cents";
import { evaluatePermission } from "@/src/domain/permissions/evaluate";
import {
  DEFAULT_AUTONOMY_POLICY,
  type AutonomyPolicy,
} from "@/src/domain/permissions/types";
import { resolveProviderId } from "@/src/domain/providers/catalog";
import {
  FlyRightConflictError,
  FlyRightNotFoundError,
} from "@/src/infrastructure/providers/flyright/types";
import { createFlyRightProvider } from "@/src/infrastructure/providers/flyright/service";
import {
  StreamlyConflictError,
  StreamlyNotFoundError,
} from "@/src/infrastructure/providers/streamly/types";
import { createStreamlyProvider } from "@/src/infrastructure/providers/streamly/service";
import {
  ElectroMartConflictError,
  ElectroMartNotFoundError,
} from "@/src/infrastructure/providers/electromart/types";
import { createElectroMartProvider } from "@/src/infrastructure/providers/electromart/service";

export class ActionError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ActionError";
    this.code = code;
  }
}

async function loadAutonomy(client: SupabaseClient, userId: string): Promise<AutonomyPolicy> {
  const { data } = await client
    .from("autonomy_policies")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) {
    return DEFAULT_AUTONOMY_POLICY;
  }

  return {
    investigateAllowed: Boolean(data.investigate_allowed),
    prepareAllowed: Boolean(data.prepare_allowed),
    highImpactAskAboveCents: Number(data.high_impact_ask_above_cents),
    killSwitch: Boolean(data.kill_switch),
  };
}

async function latestIntent(client: SupabaseClient, caseId: string, userId: string) {
  const { data, error } = await client
    .from("action_intents")
    .select("*")
    .eq("case_id", caseId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return data;
}

export async function decideAction(params: {
  repository: CaseRepository;
  client: SupabaseClient;
  userId: string;
  caseId: string;
  decision: "approved" | "denied";
}) {
  const service = new CaseService(params.repository);
  await service.getCase(params.caseId, params.userId);
  const intent = await latestIntent(params.client, params.caseId, params.userId);

  if (!intent) {
    throw new ActionError("NO_ACTION", "There is no proposed action to decide.");
  }

  if (intent.status !== "APPROVAL_REQUIRED" && intent.status !== "PROPOSED") {
    throw new ActionError("ACTION_STATE", "This action is not waiting for a decision.");
  }

  const { error: approvalError } = await params.client.from("approvals").insert({
    action_intent_id: intent.id,
    case_id: params.caseId,
    user_id: params.userId,
    decision: params.decision,
  });

  if (approvalError) {
    throw new Error(approvalError.message);
  }

  if (params.decision === "denied") {
    await params.client
      .from("action_intents")
      .update({ status: "REJECTED", updated_at: new Date().toISOString() })
      .eq("id", intent.id)
      .eq("user_id", params.userId);

    await service.transitionCase({
      caseId: params.caseId,
      userId: params.userId,
      toStatus: "READY_FOR_REVIEW",
      reason: "User denied the proposed submission",
      nextAction: "Revise or close the case",
    });

    await params.repository.appendEvent({
      caseId: params.caseId,
      userId: params.userId,
      eventType: "ACTION_DENIED",
      payload: { actionIntentId: intent.id },
    });

    return service.getCase(params.caseId, params.userId);
  }

  await params.client
    .from("action_intents")
    .update({ status: "APPROVED", updated_at: new Date().toISOString() })
    .eq("id", intent.id)
    .eq("user_id", params.userId);

  await params.repository.appendEvent({
    caseId: params.caseId,
    userId: params.userId,
    eventType: "ACTION_APPROVED",
    payload: { actionIntentId: intent.id },
  });

  return executeApprovedAction({
    repository: params.repository,
    client: params.client,
    userId: params.userId,
    caseId: params.caseId,
    autonomous: false,
  });
}

export async function executeApprovedAction(params: {
  repository: CaseRepository;
  client: SupabaseClient;
  userId: string;
  caseId: string;
  autonomous: boolean;
}) {
  const service = new CaseService(params.repository);
  let caseRecord = await service.getCase(params.caseId, params.userId);
  const intent = await latestIntent(params.client, params.caseId, params.userId);

  if (!intent) {
    throw new ActionError("NO_ACTION", "There is no action to execute.");
  }

  const policy = await loadAutonomy(params.client, params.userId);
  const amountCents =
    typeof intent.amount === "string" || typeof intent.amount === "number"
      ? parseDecimalToCents(String(intent.amount))
      : null;
  const permission = evaluatePermission({
    riskClass: "HIGH_IMPACT",
    amountCents,
    policy,
  });

  if (permission.decision === "deny") {
    throw new ActionError("PERMISSION_DENIED", permission.reasons[0] ?? "Permission denied.");
  }

  if (permission.decision === "require_approval") {
    const { data: approval } = await params.client
      .from("approvals")
      .select("*")
      .eq("action_intent_id", intent.id)
      .eq("decision", "approved")
      .maybeSingle();

    if (!approval) {
      throw new ActionError(
        "APPROVAL_REQUIRED",
        "This submission exceeds autonomy policy and has not been approved.",
      );
    }
  }

  if (caseRecord.status === "READY_FOR_REVIEW" || caseRecord.status === "AWAITING_APPROVAL") {
    caseRecord = await service.transitionCase({
      caseId: params.caseId,
      userId: params.userId,
      toStatus: "EXECUTING",
      autonomousExecutionAllowed: permission.decision === "allow",
      reason: "Executing approved provider action",
      nextAction: "Verify provider state",
    });
  }

  await params.client
    .from("action_intents")
    .update({ status: "EXECUTING", updated_at: new Date().toISOString() })
    .eq("id", intent.id);

  const payload = intent.payload as Record<string, unknown>;
  const providerId = resolveProviderId(caseRecord.provider);

  try {
    const submitted = await submitProviderMutation({
      providerId,
      payload,
      amount: String(payload.amount ?? intent.amount),
      currency: String(payload.currency ?? intent.currency ?? "EUR"),
      idempotencyKey: intent.idempotency_key,
      aegisCaseId: params.caseId,
    });

    await params.client.from("verifications").insert({
      action_intent_id: intent.id,
      case_id: params.caseId,
      user_id: params.userId,
      expected: submitted.expected,
      observed: submitted.observed,
      matched: submitted.matched,
    });

    if (!submitted.matched) {
      await params.client
        .from("action_intents")
        .update({ status: "FAILED", updated_at: new Date().toISOString() })
        .eq("id", intent.id);

      return service.transitionCase({
        caseId: params.caseId,
        userId: params.userId,
        toStatus: "FAILED",
        reason: "Provider state did not match the submitted action",
        nextAction: "Inspect verification",
      });
    }

    await params.client
      .from("action_intents")
      .update({ status: "VERIFIED", updated_at: new Date().toISOString() })
      .eq("id", intent.id);

    await params.repository.appendEvent({
      caseId: params.caseId,
      userId: params.userId,
      eventType: "CLAIM_VERIFIED",
      payload: { claimId: submitted.id, status: submitted.status, provider: providerId },
    });

    caseRecord = await service.transitionCase({
      caseId: params.caseId,
      userId: params.userId,
      toStatus: "SUBMITTED",
      reason: "Provider action verified",
      nextAction: "Monitor provider status",
    });

    return service.transitionCase({
      caseId: params.caseId,
      userId: params.userId,
      toStatus: "UNDER_REVIEW",
      reason: "Provider accepted the filing into review",
      nextAction: "Wait for provider review",
    });
  } catch (error) {
    const message = isProviderBoundaryError(error) ? error.message : "Provider submission failed.";

    await params.client
      .from("action_intents")
      .update({ status: "FAILED", updated_at: new Date().toISOString() })
      .eq("id", intent.id);

    await params.repository.appendEvent({
      caseId: params.caseId,
      userId: params.userId,
      eventType: "CLAIM_FAILED",
      payload: { message },
    });

    if (caseRecord.status === "EXECUTING") {
      return service.transitionCase({
        caseId: params.caseId,
        userId: params.userId,
        toStatus: "FAILED",
        reason: message,
        nextAction: message,
      });
    }

    throw new ActionError("EXECUTION_FAILED", message);
  }
}

function isProviderBoundaryError(error: unknown): error is Error {
  return (
    error instanceof FlyRightConflictError ||
    error instanceof FlyRightNotFoundError ||
    error instanceof StreamlyConflictError ||
    error instanceof StreamlyNotFoundError ||
    error instanceof ElectroMartConflictError ||
    error instanceof ElectroMartNotFoundError
  );
}

async function submitProviderMutation(params: {
  providerId: ReturnType<typeof resolveProviderId>;
  payload: Record<string, unknown>;
  amount: string;
  currency: string;
  idempotencyKey: string;
  aegisCaseId: string;
}): Promise<{
  id: string;
  status: string;
  expected: Record<string, unknown>;
  observed: object;
  matched: boolean;
}> {
  if (params.providerId === "unspecified") {
    throw new ActionError("NO_ACTION", "Unrouted mail has no provider mutation.");
  }

  if (params.providerId === "streamly") {
    const streamly = createStreamlyProvider();
    const submitted = await streamly.requestRefund({
      subscriptionId: String(params.payload.subscriptionId),
      accountEmail: String(params.payload.accountEmail),
      amount: params.amount,
      currency: params.currency,
      idempotencyKey: params.idempotencyKey,
      aegisCaseId: params.aegisCaseId,
    });
    const observed = await streamly.getRefundStatus(submitted.id);
    const matched =
      observed.id === submitted.id &&
      observed.amount === params.amount &&
      observed.subscriptionId === String(params.payload.subscriptionId);
    return {
      id: observed.id,
      status: observed.status,
      expected: {
        refundId: submitted.id,
        amount: params.amount,
        subscriptionId: params.payload.subscriptionId,
      },
      observed,
      matched,
    };
  }

  if (params.providerId === "electromart") {
    const electromart = createElectroMartProvider();
    const submitted = await electromart.submitWarrantyClaim({
      orderId: String(params.payload.orderId),
      lastName: String(params.payload.lastName),
      amount: params.amount,
      currency: params.currency,
      idempotencyKey: params.idempotencyKey,
      aegisCaseId: params.aegisCaseId,
    });
    const observed = await electromart.getClaimStatus(submitted.id);
    const matched =
      observed.id === submitted.id &&
      observed.amount === params.amount &&
      observed.orderId === String(params.payload.orderId);
    return {
      id: observed.id,
      status: observed.status,
      expected: { claimId: submitted.id, amount: params.amount, orderId: params.payload.orderId },
      observed,
      matched,
    };
  }

  const flyright = createFlyRightProvider();
  const submitted = await flyright.submitClaim({
    locator: String(params.payload.locator),
    lastName: String(params.payload.lastName),
    amount: params.amount,
    currency: params.currency,
    idempotencyKey: params.idempotencyKey,
    aegisCaseId: params.aegisCaseId,
  });
  const observed = await flyright.getClaimStatus(submitted.id);
  const matched =
    observed.id === submitted.id &&
    observed.amount === params.amount &&
    observed.locator === String(params.payload.locator);
  return {
    id: observed.id,
    status: observed.status,
    expected: { claimId: submitted.id, amount: params.amount, locator: params.payload.locator },
    observed,
    matched,
  };
}

export async function syncClaimStatus(params: {
  repository: CaseRepository;
  client: SupabaseClient;
  userId: string;
  caseId: string;
}) {
  const service = new CaseService(params.repository);
  const caseRecord = await service.getCase(params.caseId, params.userId);
  const intent = await latestIntent(params.client, params.caseId, params.userId);
  if (!intent || !caseRecord.bookingLocator) {
    throw new ActionError("NO_ACTION", "Nothing to sync yet.");
  }

  const providerId = resolveProviderId(caseRecord.provider);
  const mutation = await readProviderMutation(providerId, caseRecord.bookingLocator);
  if (!mutation) {
    throw new ActionError("NO_CLAIM", "The provider has no claim or refund for this identity.");
  }

  await params.repository.appendEvent({
    caseId: params.caseId,
    userId: params.userId,
    eventType: "PROVIDER_STATUS_SYNCED",
    payload: { claimId: mutation.id, status: mutation.status, provider: providerId },
  });

  if (mutation.status === "NEEDS_INFORMATION" && caseRecord.status === "UNDER_REVIEW") {
    return service.transitionCase({
      caseId: params.caseId,
      userId: params.userId,
      toStatus: "NEEDS_INFORMATION",
      reason: "Provider requested more information",
      nextAction: "Provide the requested evidence",
    });
  }

  if (mutation.status === "ACCEPTED" && caseRecord.status === "UNDER_REVIEW") {
    return service.transitionCase({
      caseId: params.caseId,
      userId: params.userId,
      toStatus: "RESOLVED",
      reason: "Provider accepted the filing",
      nextAction: "Close the case",
    });
  }

  return caseRecord;
}

async function readProviderMutation(
  providerId: ReturnType<typeof resolveProviderId>,
  locator: string,
): Promise<{ id: string; status: string } | null> {
  if (providerId === "streamly") {
    const refund = await createStreamlyProvider().getRefundForSubscription(locator);
    return refund ? { id: refund.id, status: refund.status } : null;
  }
  if (providerId === "electromart") {
    const claim = await createElectroMartProvider().getClaimForOrder(locator);
    return claim ? { id: claim.id, status: claim.status } : null;
  }
  const claim = await createFlyRightProvider().getClaimForBooking(locator);
  return claim ? { id: claim.id, status: claim.status } : null;
}
