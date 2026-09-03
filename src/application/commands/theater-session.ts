import "server-only";

import { createHash, randomBytes } from "crypto";
import { z } from "zod";
import {
  assertTheaterExecute,
  deriveTheaterApproval,
  TheaterPermissionError,
} from "@/src/domain/theater/permission";
import type {
  TheaterProviderId,
  TheaterSnapshot,
  TheaterWorkItemIdentity,
  TheaterWorkItemSnapshot,
  TheaterWorkItemStatus,
} from "@/src/domain/theater/types";
import type { EligibilityDecision } from "@/src/domain/eligibility/types";
import { normalizeSqlMoney } from "@/src/domain/money/cents";
import { createAdminSupabaseClient } from "@/src/infrastructure/db/supabase/admin";
import { createFlyRightProvider } from "@/src/infrastructure/providers/flyright/service";
import { createStreamlyProvider } from "@/src/infrastructure/providers/streamly/service";
import { createElectroMartProvider } from "@/src/infrastructure/providers/electromart/service";

export const THEATER_COOKIE = "aegis_theater";
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

export class TheaterSessionError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "TheaterSessionError";
    this.code = code;
    this.status = status;
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function mintToken(): string {
  return randomBytes(32).toString("hex");
}

const providerIdSchema = z.enum(["flyright", "streamly", "electromart"]);

function asProviderId(value: unknown): TheaterProviderId {
  const parsed = providerIdSchema.safeParse(value);
  if (!parsed.success) {
    throw new TheaterSessionError("INVALID_PROVIDER", "Work item provider is invalid.", 500);
  }
  return parsed.data;
}

function asStatus(value: unknown): TheaterWorkItemStatus {
  const parsed = z
    .enum([
      "UNINSPECTED",
      "INSPECTED",
      "ENTITLED",
      "PREPARED",
      "AWAITING_SIGNATURE",
      "APPROVED",
      "DENIED",
      "EXECUTED",
      "VERIFIED",
      "FAILED",
    ])
    .safeParse(value);
  if (!parsed.success) {
    throw new TheaterSessionError("INVALID_STATUS", "Work item status is invalid.", 500);
  }
  return parsed.data;
}

const identitySchema = z
  .object({
    providerId: providerIdSchema,
  })
  .passthrough();

function asIdentity(value: unknown): TheaterWorkItemIdentity {
  const parsed = identitySchema.safeParse(value);
  if (!parsed.success) {
    throw new TheaterSessionError("INVALID_IDENTITY", "Work item identity is invalid.", 500);
  }

  if (parsed.data.providerId === "flyright") {
    const typed = z
      .object({ providerId: z.literal("flyright"), locator: z.string().min(3), lastName: z.string().min(1) })
      .parse(parsed.data);
    return typed;
  }
  if (parsed.data.providerId === "streamly") {
    const typed = z
      .object({
        providerId: z.literal("streamly"),
        subscriptionId: z.string().min(3),
        accountEmail: z.string().email(),
      })
      .parse(parsed.data);
    return typed;
  }
  const typed = z
    .object({ providerId: z.literal("electromart"), orderId: z.string().min(3), lastName: z.string().min(1) })
    .parse(parsed.data);
  return typed;
}

function asDecision(value: unknown): EligibilityDecision | null {
  if (!value) return null;
  const parsed = z
    .object({
      outcome: z.enum(["eligible", "ineligible", "uncertain"]),
      amount: z.string().nullable(),
      currency: z.string(),
      ruleIds: z.array(z.string()),
      reasons: z.array(z.string()),
    })
    .safeParse(value);
  if (!parsed.success) {
    return null;
  }
  return parsed.data;
}

interface SessionRow {
  id: string;
  token_hash: string;
  expires_at: string;
}

interface WorkItemRow {
  id: string;
  session_id: string;
  provider_id: string;
  title: string;
  identity: unknown;
  status: string;
  counter: unknown | null;
  entitlement: unknown | null;
  proposal: unknown | null;
  approved_at: string | null;
  denied_at: string | null;
  approved_amount: unknown | null;
  approved_currency: string | null;
  verification: unknown | null;
  idempotency_key: string | null;
  last_mutation_id: string | null;
  last_mutation_status: string | null;
}

async function loadSessionRow(token: string): Promise<SessionRow> {
  const client = createAdminSupabaseClient();
  const { data, error } = await client
    .from("theater_sessions")
    .select("*")
    .eq("token_hash", hashToken(token))
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new TheaterSessionError("THEATER_NOT_FOUND", "No theater session on this browser.", 404);
  }
  return {
    id: String(data.id),
    token_hash: String(data.token_hash),
    expires_at: String(data.expires_at),
  };
}

async function loadItems(sessionId: string): Promise<WorkItemRow[]> {
  const client = createAdminSupabaseClient();
  const { data, error } = await client
    .from("theater_work_items")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => row as unknown as WorkItemRow);
}

function mapItem(row: WorkItemRow): TheaterWorkItemSnapshot {
  const providerId = asProviderId(row.provider_id);
  const identity = asIdentity(row.identity);
  const status = asStatus(row.status);
  const entitlement = asDecision(row.entitlement);
  const proposal = row.proposal ? (row.proposal as TheaterWorkItemSnapshot["proposal"]) : null;
  const verification = row.verification ? (row.verification as TheaterWorkItemSnapshot["verification"]) : null;

  const approvedAmount = row.approved_amount != null ? normalizeSqlMoney(row.approved_amount) : null;

  return {
    id: row.id,
    providerId,
    title: row.title,
    identity,
    status,
    counter: (row.counter as Record<string, unknown> | null) ?? null,
    entitlement,
    proposal,
    approval: {
      state: deriveTheaterApproval({ approvedAt: row.approved_at, deniedAt: row.denied_at }),
      approvedAmount,
      approvedCurrency: row.approved_currency,
      approvedAt: row.approved_at,
      deniedAt: row.denied_at,
    },
    verification,
  };
}

async function snapshotFrom(session: SessionRow): Promise<TheaterSnapshot> {
  const items = await loadItems(session.id);
  return {
    sessionId: session.id,
    expiresAt: session.expires_at,
    items: items.map(mapItem),
  };
}

export async function createTheaterSession(): Promise<{ token: string; snapshot: TheaterSnapshot }> {
  const flyright = createFlyRightProvider();
  const streamly = createStreamlyProvider();
  const electromart = createElectroMartProvider();

  const booking = await flyright.issueChamberTicket();
  const subscription = await streamly.issueTheaterSubscription();
  const order = await electromart.issueTheaterOrder();

  const token = mintToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  const client = createAdminSupabaseClient();
  const { data, error } = await client
    .from("theater_sessions")
    .insert({
      token_hash: hashToken(token),
      expires_at: expiresAt,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not create theater session.");
  }

  const session: SessionRow = {
    id: String(data.id),
    token_hash: String(data.token_hash),
    expires_at: String(data.expires_at),
  };

  const itemsToInsert = [
    {
      session_id: session.id,
      provider_id: "flyright",
      title: "Cancelled flight refund",
      identity: { providerId: "flyright", locator: booking.locator, lastName: booking.lastName },
      status: "UNINSPECTED",
    },
    {
      session_id: session.id,
      provider_id: "streamly",
      title: "Billed-after-cancel refund",
      identity: {
        providerId: "streamly",
        subscriptionId: subscription.subscriptionId,
        accountEmail: subscription.accountEmail,
      },
      status: "UNINSPECTED",
    },
    {
      session_id: session.id,
      provider_id: "electromart",
      title: "In-warranty defect claim",
      identity: { providerId: "electromart", orderId: order.orderId, lastName: order.lastName },
      status: "UNINSPECTED",
    },
  ];

  const { error: itemError } = await client.from("theater_work_items").insert(itemsToInsert);
  if (itemError) {
    throw new Error(itemError.message);
  }

  return { token, snapshot: await snapshotFrom(session) };
}

export async function getTheaterSnapshot(token: string): Promise<TheaterSnapshot> {
  const session = await loadSessionRow(token);
  return snapshotFrom(session);
}

export function theaterCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  };
}

export async function decideTheaterWorkItem(params: {
  token: string;
  workItemId: string;
  decision: "approved" | "denied";
}): Promise<TheaterSnapshot> {
  const session = await loadSessionRow(params.token);
  if (new Date() > new Date(session.expires_at)) {
    throw new TheaterSessionError("EXPIRED", "This theater session has expired. Issue a fresh session.", 409);
  }

  const client = createAdminSupabaseClient();
  const { data: item, error } = await client
    .from("theater_work_items")
    .select("*")
    .eq("id", params.workItemId)
    .eq("session_id", session.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!item) {
    throw new TheaterSessionError("WORK_ITEM_NOT_FOUND", "Work item not found.", 404);
  }

  const row = item as unknown as WorkItemRow;
  const proposal = row.proposal as TheaterWorkItemSnapshot["proposal"] | null;
  if (!proposal || !proposal.amount || !proposal.currency) {
    throw new TheaterSessionError("NOT_PREPARED", "This filing is not prepared yet.", 409);
  }

  if (params.decision === "denied") {
    const { error: updateError } = await client
      .from("theater_work_items")
      .update({
        denied_at: new Date().toISOString(),
        approved_at: null,
        approved_amount: null,
        approved_currency: null,
        status: "DENIED",
      })
      .eq("id", row.id)
      .eq("session_id", session.id);
    if (updateError) {
      throw new Error(updateError.message);
    }
    return snapshotFrom(session);
  }

  const { error: approveError } = await client
    .from("theater_work_items")
    .update({
      approved_at: new Date().toISOString(),
      denied_at: null,
      approved_amount: proposal.amount,
      approved_currency: proposal.currency,
      status: "APPROVED",
    })
    .eq("id", row.id)
    .eq("session_id", session.id);

  if (approveError) {
    throw new Error(approveError.message);
  }

  return snapshotFrom(session);
}

async function loadItemOrThrow(params: { sessionId: string; workItemId: string }): Promise<WorkItemRow> {
  const client = createAdminSupabaseClient();
  const { data, error } = await client
    .from("theater_work_items")
    .select("*")
    .eq("id", params.workItemId)
    .eq("session_id", params.sessionId)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new TheaterSessionError("WORK_ITEM_NOT_FOUND", "Work item not found.", 404);
  }
  return data as unknown as WorkItemRow;
}

export async function executeTheaterTool(params: {
  token: string;
  tool: string;
  input: Record<string, unknown>;
}): Promise<{ result: Record<string, unknown>; snapshot: TheaterSnapshot }> {
  const session = await loadSessionRow(params.token);
  const held = await snapshotFrom(session);
  const tool = params.tool;
  const input = params.input;

  switch (tool) {
    case "list_work_items": {
      return { result: { items: held.items }, snapshot: held };
    }
    case "get_work_item": {
      const workItemId = String(input.workItemId ?? "");
      const row = await loadItemOrThrow({ sessionId: session.id, workItemId });
      return { result: { item: mapItem(row) }, snapshot: await snapshotFrom(session) };
    }
    case "inspect_counter": {
      const workItemId = String(input.workItemId ?? "");
      const row = await loadItemOrThrow({ sessionId: session.id, workItemId });
      const providerId = asProviderId(row.provider_id);
      const identity = asIdentity(row.identity);

      const counter = await inspectProvider(providerId, identity);
      await createAdminSupabaseClient()
        .from("theater_work_items")
        .update({ counter, status: row.status === "UNINSPECTED" ? "INSPECTED" : row.status })
        .eq("id", row.id)
        .eq("session_id", session.id);

      return { result: { counter }, snapshot: await snapshotFrom(session) };
    }
    case "compute_entitlement": {
      const workItemId = String(input.workItemId ?? "");
      const row = await loadItemOrThrow({ sessionId: session.id, workItemId });
      const providerId = asProviderId(row.provider_id);
      const identity = asIdentity(row.identity);

      const entitlement = await computeEntitlement(providerId, identity);
      await createAdminSupabaseClient()
        .from("theater_work_items")
        .update({ entitlement, status: "ENTITLED" })
        .eq("id", row.id)
        .eq("session_id", session.id);

      return { result: { entitlement }, snapshot: await snapshotFrom(session) };
    }
    case "prepare_filing": {
      const workItemId = String(input.workItemId ?? "");
      const row = await loadItemOrThrow({ sessionId: session.id, workItemId });
      const providerId = asProviderId(row.provider_id);
      const identity = asIdentity(row.identity);

      const entitlement = asDecision(row.entitlement);
      if (!entitlement || entitlement.outcome !== "eligible" || !entitlement.amount) {
        throw new TheaterSessionError(
          "NOT_ELIGIBLE",
          entitlement?.reasons?.[0] ?? "Work item is not eligible to prepare.",
          409,
        );
      }

      const { proposal, idempotencyKey } = buildProposal({
        sessionId: session.id,
        workItemId: row.id,
        providerId,
        identity,
        amount: entitlement.amount,
        currency: entitlement.currency,
      });

      await createAdminSupabaseClient()
        .from("theater_work_items")
        .update({
          proposal,
          idempotency_key: idempotencyKey,
          status: "PREPARED",
          approved_at: null,
          denied_at: null,
          approved_amount: null,
          approved_currency: null,
        })
        .eq("id", row.id)
        .eq("session_id", session.id);

      return { result: { proposal }, snapshot: await snapshotFrom(session) };
    }
    case "request_signature": {
      const workItemId = String(input.workItemId ?? "");
      const row = await loadItemOrThrow({ sessionId: session.id, workItemId });
      if (!row.proposal) {
        throw new TheaterSessionError("NOT_PREPARED", "Prepare the filing before requesting a signature.", 409);
      }
      await createAdminSupabaseClient()
        .from("theater_work_items")
        .update({
          status: "AWAITING_SIGNATURE",
          approved_at: null,
          denied_at: null,
          approved_amount: null,
          approved_currency: null,
        })
        .eq("id", row.id)
        .eq("session_id", session.id);

      return { result: { ok: true }, snapshot: await snapshotFrom(session) };
    }
    case "execute_filing": {
      const workItemId = String(input.workItemId ?? "");
      const row = await loadItemOrThrow({ sessionId: session.id, workItemId });
      const providerId = asProviderId(row.provider_id);
      const identity = asIdentity(row.identity);
      const proposal = row.proposal as TheaterWorkItemSnapshot["proposal"] | null;
      const approvedAmount = row.approved_amount != null ? normalizeSqlMoney(row.approved_amount) : null;

      assertTheaterExecute({
        now: new Date(),
        expiresAt: session.expires_at,
        status: asStatus(row.status),
        approvedAt: row.approved_at,
        deniedAt: row.denied_at,
        proposalAmount: proposal?.amount ?? null,
        proposalCurrency: proposal?.currency ?? null,
        approvedAmount,
        approvedCurrency: row.approved_currency ?? null,
      });

      if (!proposal || !proposal.amount) {
        throw new TheaterSessionError("NOT_PREPARED", "Prepare the filing before execution.", 409);
      }
      const idempotencyKey = String(row.idempotency_key ?? proposal.idempotencyKey ?? "");
      if (!idempotencyKey) {
        throw new TheaterSessionError("MISSING_IDEMPOTENCY", "Missing idempotency key.", 500);
      }

      const mutation = await executeProviderMutation({
        providerId,
        identity,
        amount: proposal.amount,
        currency: proposal.currency,
        idempotencyKey,
        theaterSessionId: session.id,
        workItemId: row.id,
      });

      await createAdminSupabaseClient()
        .from("theater_work_items")
        .update({
          status: "EXECUTED",
          last_mutation_id: mutation.id,
          last_mutation_status: mutation.status,
        })
        .eq("id", row.id)
        .eq("session_id", session.id);

      return { result: { mutation }, snapshot: await snapshotFrom(session) };
    }
    case "verify_filing": {
      const workItemId = String(input.workItemId ?? "");
      const row = await loadItemOrThrow({ sessionId: session.id, workItemId });
      const providerId = asProviderId(row.provider_id);
      const identity = asIdentity(row.identity);
      const proposal = row.proposal as TheaterWorkItemSnapshot["proposal"] | null;
      const mutationId = row.last_mutation_id;

      if (!proposal || !proposal.amount || !proposal.currency) {
        throw new TheaterSessionError("NOT_PREPARED", "Prepare and execute a filing before verification.", 409);
      }
      if (!mutationId) {
        throw new TheaterSessionError("NO_MUTATION", "No provider mutation is recorded for this item.", 409);
      }

      const verification = await verifyProviderMutation({
        providerId,
        identity,
        mutationId,
        amount: proposal.amount,
        currency: proposal.currency,
      });

      await createAdminSupabaseClient()
        .from("theater_work_items")
        .update({
          verification,
          status: verification.matched ? "VERIFIED" : "FAILED",
        })
        .eq("id", row.id)
        .eq("session_id", session.id);

      return { result: { verification }, snapshot: await snapshotFrom(session) };
    }
    default:
      throw new TheaterSessionError("UNKNOWN_TOOL", `Unknown theater tool: ${tool}`, 400);
  }
}

async function inspectProvider(providerId: TheaterProviderId, identity: TheaterWorkItemIdentity) {
  if (providerId === "flyright" && identity.providerId === "flyright") {
    const flyright = createFlyRightProvider();
    const booking = await flyright.getBooking(identity.locator, identity.lastName);
    const claim = await flyright.getClaimForBooking(booking.locator);
    return { booking, claim };
  }
  if (providerId === "streamly" && identity.providerId === "streamly") {
    const streamly = createStreamlyProvider();
    const subscription = await streamly.getSubscription(identity.subscriptionId, identity.accountEmail);
    const refund = await streamly.getRefundForSubscription(subscription.subscriptionId);
    return { subscription, refund };
  }
  const electromart = createElectroMartProvider();
  if (identity.providerId !== "electromart") {
    throw new TheaterSessionError("IDENTITY_MISMATCH", "Identity does not match the work item provider.", 500);
  }
  const order = await electromart.getOrder(identity.orderId, identity.lastName);
  const claim = await electromart.getClaimForOrder(order.orderId);
  return { order, claim };
}

async function computeEntitlement(providerId: TheaterProviderId, identity: TheaterWorkItemIdentity): Promise<EligibilityDecision> {
  if (providerId === "flyright" && identity.providerId === "flyright") {
    const flyright = createFlyRightProvider();
    const compensation = await flyright.calculateCompensation(identity.locator, identity.lastName);
    return {
      outcome: compensation.outcome as EligibilityDecision["outcome"],
      amount: compensation.amount,
      currency: compensation.currency,
      reasons: compensation.reasons,
      ruleIds: compensation.ruleIds,
    };
  }
  if (providerId === "streamly" && identity.providerId === "streamly") {
    const streamly = createStreamlyProvider();
    const refund = await streamly.calculateRefund(identity.subscriptionId, identity.accountEmail);
    return {
      outcome: refund.outcome as EligibilityDecision["outcome"],
      amount: refund.amount,
      currency: refund.currency,
      reasons: refund.reasons,
      ruleIds: refund.ruleIds,
    };
  }
  const electromart = createElectroMartProvider();
  if (identity.providerId !== "electromart") {
    throw new TheaterSessionError("IDENTITY_MISMATCH", "Identity does not match the work item provider.", 500);
  }
  const warranty = await electromart.calculateWarranty(identity.orderId, identity.lastName);
  return {
    outcome: warranty.outcome as EligibilityDecision["outcome"],
    amount: warranty.amount,
    currency: warranty.currency,
    reasons: warranty.reasons,
    ruleIds: warranty.ruleIds,
  };
}

function buildProposal(params: {
  sessionId: string;
  workItemId: string;
  providerId: TheaterProviderId;
  identity: TheaterWorkItemIdentity;
  amount: string;
  currency: string;
}): { proposal: TheaterWorkItemSnapshot["proposal"]; idempotencyKey: string } {
  const idempotencyKey = `theater:${params.sessionId}:${params.workItemId}:${params.providerId}`;

  if (params.providerId === "flyright" && params.identity.providerId === "flyright") {
    const payload = {
      locator: params.identity.locator,
      lastName: params.identity.lastName,
      amount: params.amount,
      currency: params.currency,
    };
    return {
      idempotencyKey,
      proposal: {
        toolName: "submit_claim",
        payload,
        amount: params.amount,
        currency: params.currency,
        idempotencyKey,
        expectedVerification: {
          locator: params.identity.locator,
          amount: params.amount,
          currency: params.currency,
        },
      },
    };
  }

  if (params.providerId === "streamly" && params.identity.providerId === "streamly") {
    const payload = {
      subscriptionId: params.identity.subscriptionId,
      accountEmail: params.identity.accountEmail,
      amount: params.amount,
      currency: params.currency,
    };
    return {
      idempotencyKey,
      proposal: {
        toolName: "request_refund",
        payload,
        amount: params.amount,
        currency: params.currency,
        idempotencyKey,
        expectedVerification: {
          subscriptionId: params.identity.subscriptionId,
          amount: params.amount,
          currency: params.currency,
        },
      },
    };
  }

  if (params.identity.providerId !== "electromart") {
    throw new TheaterSessionError("IDENTITY_MISMATCH", "Identity does not match the work item provider.", 500);
  }

  const payload = {
    orderId: params.identity.orderId,
    lastName: params.identity.lastName,
    amount: params.amount,
    currency: params.currency,
  };
  return {
    idempotencyKey,
    proposal: {
      toolName: "submit_warranty_claim",
      payload,
      amount: params.amount,
      currency: params.currency,
      idempotencyKey,
      expectedVerification: {
        orderId: params.identity.orderId,
        amount: params.amount,
        currency: params.currency,
      },
    },
  };
}

async function executeProviderMutation(params: {
  providerId: TheaterProviderId;
  identity: TheaterWorkItemIdentity;
  amount: string;
  currency: string;
  idempotencyKey: string;
  theaterSessionId: string;
  workItemId: string;
}): Promise<{ id: string; status: string }> {
  if (params.providerId === "flyright" && params.identity.providerId === "flyright") {
    const flyright = createFlyRightProvider();
    const claim = await flyright.submitClaim({
      locator: params.identity.locator,
      lastName: params.identity.lastName,
      amount: params.amount,
      currency: params.currency,
      idempotencyKey: params.idempotencyKey,
      aegisCaseId: `theater:${params.theaterSessionId}:${params.workItemId}`,
    });
    return { id: claim.id, status: claim.status };
  }

  if (params.providerId === "streamly" && params.identity.providerId === "streamly") {
    const streamly = createStreamlyProvider();
    const refund = await streamly.requestRefund({
      subscriptionId: params.identity.subscriptionId,
      accountEmail: params.identity.accountEmail,
      amount: params.amount,
      currency: params.currency,
      idempotencyKey: params.idempotencyKey,
      aegisCaseId: `theater:${params.theaterSessionId}:${params.workItemId}`,
    });
    return { id: refund.id, status: refund.status };
  }

  const electromart = createElectroMartProvider();
  if (params.identity.providerId !== "electromart") {
    throw new TheaterSessionError("IDENTITY_MISMATCH", "Identity does not match the work item provider.", 500);
  }
  const claim = await electromart.submitWarrantyClaim({
    orderId: params.identity.orderId,
    lastName: params.identity.lastName,
    amount: params.amount,
    currency: params.currency,
    idempotencyKey: params.idempotencyKey,
    aegisCaseId: `theater:${params.theaterSessionId}:${params.workItemId}`,
  });
  return { id: claim.id, status: claim.status };
}

async function verifyProviderMutation(params: {
  providerId: TheaterProviderId;
  identity: TheaterWorkItemIdentity;
  mutationId: string;
  amount: string;
  currency: string;
}): Promise<NonNullable<TheaterWorkItemSnapshot["verification"]>> {
  if (params.providerId === "flyright" && params.identity.providerId === "flyright") {
    const flyright = createFlyRightProvider();
    const observed = await flyright.getClaimStatus(params.mutationId);
    const matched =
      observed.id === params.mutationId &&
      observed.locator === params.identity.locator &&
      observed.amount === params.amount &&
      observed.currency === params.currency;
    return {
      expected: { claimId: params.mutationId, locator: params.identity.locator, amount: params.amount, currency: params.currency },
      observed: { ...observed },
      matched,
    };
  }

  if (params.providerId === "streamly" && params.identity.providerId === "streamly") {
    const streamly = createStreamlyProvider();
    const observed = await streamly.getRefundStatus(params.mutationId);
    const matched =
      observed.id === params.mutationId &&
      observed.subscriptionId === params.identity.subscriptionId &&
      observed.amount === params.amount &&
      observed.currency === params.currency;
    return {
      expected: { refundId: params.mutationId, subscriptionId: params.identity.subscriptionId, amount: params.amount, currency: params.currency },
      observed: { ...observed },
      matched,
    };
  }

  const electromart = createElectroMartProvider();
  if (params.identity.providerId !== "electromart") {
    throw new TheaterSessionError("IDENTITY_MISMATCH", "Identity does not match the work item provider.", 500);
  }
  const observed = await electromart.getClaimStatus(params.mutationId);
  const matched =
    observed.id === params.mutationId &&
    observed.orderId === params.identity.orderId &&
    observed.amount === params.amount &&
    observed.currency === params.currency;
  return {
    expected: { claimId: params.mutationId, orderId: params.identity.orderId, amount: params.amount, currency: params.currency },
    observed: { ...observed },
    matched,
  };
}

export { TheaterPermissionError };

