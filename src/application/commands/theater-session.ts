import "server-only";

import { createHash, randomBytes } from "crypto";
import { z } from "zod";
import { isCatalogBlocked, workItemNarrative } from "@/src/domain/theater/catalog";
import { TheaterSessionError } from "@/src/domain/theater/errors";
import {
  assertTheaterExecute,
  deriveTheaterApproval,
  TheaterPermissionError,
} from "@/src/domain/theater/permission";
import {
  assertPrepareAllowed,
  assertRequestSignatureAllowed,
  assertSessionNotExpired,
  decideAction,
  entitleNextStatus,
  executeMode,
  inspectNextStatus,
  nextActionsFor,
  prepareAction,
  requestSignatureAction,
  sessionIsExpired,
} from "@/src/domain/theater/state";
import {
  getTheaterTool,
  parseTheaterToolName,
  parseWorkItemId,
  theaterToolNameSchema,
  type TheaterToolName,
} from "@/src/domain/theater/tools";
import type {
  TheaterLastError,
  TheaterProposal,
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

export { TheaterSessionError } from "@/src/domain/theater/errors";

export const THEATER_COOKIE = "aegis_theater";
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const SESSION_MINT_COOLDOWN_MS = 8_000;

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
    return z
      .object({ providerId: z.literal("flyright"), locator: z.string().min(3), lastName: z.string().min(1) })
      .parse(parsed.data);
  }
  if (parsed.data.providerId === "streamly") {
    return z
      .object({
        providerId: z.literal("streamly"),
        subscriptionId: z.string().min(3),
        accountEmail: z.string().email(),
      })
      .parse(parsed.data);
  }
  return z
    .object({ providerId: z.literal("electromart"), orderId: z.string().min(3), lastName: z.string().min(1) })
    .parse(parsed.data);
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
  return parsed.success ? parsed.data : null;
}

function asProposal(value: unknown): TheaterProposal | null {
  if (!value) return null;
  const parsed = z
    .object({
      toolName: z.string(),
      payload: z.record(z.unknown()),
      amount: z.string().nullable(),
      currency: z.string(),
      idempotencyKey: z.string(),
      expectedVerification: z.record(z.unknown()),
      version: z.number().int().nonnegative().optional(),
    })
    .safeParse(value);
  if (!parsed.success) {
    return null;
  }
  return { ...parsed.data, version: parsed.data.version ?? 1 };
}

function asLastError(value: unknown): TheaterLastError | null {
  if (!value) return null;
  const parsed = z
    .object({
      code: z.string(),
      message: z.string(),
      at: z.string(),
    })
    .safeParse(value);
  return parsed.success ? parsed.data : null;
}

interface SessionRow {
  id: string;
  token_hash: string;
  expires_at: string;
  created_at?: string;
  superseded_at?: string | null;
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
  last_error: unknown | null;
  last_attempt_at: string | null;
  attempt_count: number | null;
  proposal_version: number | null;
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
    created_at: data.created_at ? String(data.created_at) : undefined,
    superseded_at: data.superseded_at ? String(data.superseded_at) : null,
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
  const proposal = asProposal(row.proposal);
  const verification = row.verification ? (row.verification as TheaterWorkItemSnapshot["verification"]) : null;
  const catalogBlocked = isCatalogBlocked(identity);
  const narrative = workItemNarrative(identity);
  const approvedAmount = row.approved_amount != null ? normalizeSqlMoney(row.approved_amount) : null;
  const lastMutationId = row.last_mutation_id;

  return {
    id: row.id,
    providerId,
    title: row.title,
    identity,
    status,
    catalogBlocked,
    problem: narrative.problem,
    source: narrative.source,
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
    lastError: asLastError(row.last_error),
    attemptCount: Number(row.attempt_count ?? 0),
    lastMutationId,
    lastMutationStatus: row.last_mutation_status,
    nextActions: nextActionsFor({
      status,
      catalogBlocked,
      eligible: entitlement ? entitlement.outcome === "eligible" : null,
      hasMutation: Boolean(lastMutationId),
    }),
  };
}

async function snapshotFrom(session: SessionRow): Promise<TheaterSnapshot> {
  const items = await loadItems(session.id);
  return {
    sessionId: session.id,
    expiresAt: session.expires_at,
    expired: sessionIsExpired(new Date(), session.expires_at) || Boolean(session.superseded_at),
    items: items.map(mapItem),
  };
}

async function recordAudit(params: {
  sessionId: string;
  workItemId?: string | null;
  eventType: string;
  payload?: Record<string, unknown>;
}) {
  const client = createAdminSupabaseClient();
  const { error } = await client.from("theater_audit_events").insert({
    session_id: params.sessionId,
    work_item_id: params.workItemId ?? null,
    event_type: params.eventType,
    payload: params.payload ?? {},
  });
  if (error) {
    throw new Error(error.message);
  }
}

async function supersedeSession(token: string): Promise<SessionRow | null> {
  try {
    const session = await loadSessionRow(token);
    const now = new Date().toISOString();
    const { error } = await createAdminSupabaseClient()
      .from("theater_sessions")
      .update({ superseded_at: now, expires_at: now })
      .eq("id", session.id);
    if (error) {
      throw new Error(error.message);
    }
    return session;
  } catch (error) {
    if (error instanceof TheaterSessionError && error.code === "THEATER_NOT_FOUND") {
      return null;
    }
    throw error;
  }
}

export async function createTheaterSession(options?: {
  previousToken?: string | null;
}): Promise<{ token: string; snapshot: TheaterSnapshot }> {
  if (options?.previousToken) {
    try {
      const previous = await loadSessionRow(options.previousToken);
      if (previous.created_at) {
        const ageMs = Date.now() - new Date(previous.created_at).getTime();
        if (ageMs >= 0 && ageMs < SESSION_MINT_COOLDOWN_MS) {
          throw new TheaterSessionError(
            "RATE_LIMITED",
            "Wait a moment before issuing another desk.",
            429,
          );
        }
      }
      await supersedeSession(options.previousToken);
    } catch (error) {
      if (error instanceof TheaterSessionError && error.code === "THEATER_NOT_FOUND") {
        // First visit or cookie already invalid — mint a new desk.
      } else {
        throw error;
      }
    }
  }

  const flyright = createFlyRightProvider();
  const streamly = createStreamlyProvider();

  let booking: { locator: string; lastName: string } | null = null;
  let subscription: { subscriptionId: string; accountEmail: string } | null = null;
  let persisted = false;

  try {
    booking = await flyright.issueChamberTicket();
    subscription = await streamly.issueTheaterSubscription();

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
      created_at: data.created_at ? String(data.created_at) : undefined,
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
        provider_id: "flyright",
        title: "Already claimed — must not file",
        identity: { providerId: "flyright", locator: "FR0999", lastName: "BERG" },
        status: "UNINSPECTED",
      },
    ];

    const { error: itemError } = await client.from("theater_work_items").insert(itemsToInsert);
    if (itemError) {
      await client.from("theater_sessions").delete().eq("id", session.id);
      throw new Error(itemError.message);
    }
    persisted = true;

    await recordAudit({
      sessionId: session.id,
      eventType: "session_created",
      payload: {
        flyrightLocator: booking.locator,
        streamlySubscriptionId: subscription.subscriptionId,
      },
    });

    return { token, snapshot: await snapshotFrom(session) };
  } catch (error) {
    if (!persisted) {
      const client = createAdminSupabaseClient();
      if (booking) {
        await client.from("flyright_bookings").delete().eq("locator", booking.locator);
      }
      if (subscription) {
        await client.from("streamly_subscriptions").delete().eq("subscription_id", subscription.subscriptionId);
      }
    }
    throw error;
  }
}

export async function getTheaterSnapshot(token: string): Promise<TheaterSnapshot> {
  const session = await loadSessionRow(token);
  const snapshot = await snapshotFrom(session);
  if (snapshot.expired) {
    throw new TheaterSessionError("SESSION_EXPIRED", "This theater session has expired. Issue a fresh desk.", 409);
  }
  return snapshot;
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
  assertSessionNotExpired(new Date(), session.expires_at);

  const row = await loadItemOrThrow({ sessionId: session.id, workItemId: params.workItemId });
  const proposal = asProposal(row.proposal);
  const action = decideAction({
    status: asStatus(row.status),
    hasProposal: Boolean(proposal?.amount && proposal.currency),
    decision: params.decision,
  });

  if (action === "replay") {
    return snapshotFrom(session);
  }

  const client = createAdminSupabaseClient();
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
      .eq("session_id", session.id)
      .eq("status", "AWAITING_SIGNATURE");
    if (updateError) {
      throw new Error(updateError.message);
    }
  } else {
    if (!proposal?.amount || !proposal.currency) {
      throw new TheaterSessionError("NOT_PREPARED", "This filing is not prepared yet.", 409);
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
      .eq("session_id", session.id)
      .eq("status", "AWAITING_SIGNATURE");
    if (approveError) {
      throw new Error(approveError.message);
    }
  }

  await recordAudit({
    sessionId: session.id,
    workItemId: row.id,
    eventType: params.decision === "approved" ? "signature_approved" : "signature_denied",
    payload: {
      amount: proposal?.amount ?? null,
      currency: proposal?.currency ?? null,
    },
  });

  return snapshotFrom(session);
}

async function loadItemOrThrow(params: { sessionId: string; workItemId: string }): Promise<WorkItemRow> {
  const parsedId = z.string().uuid().safeParse(params.workItemId);
  if (!parsedId.success) {
    throw new TheaterSessionError("INVALID_ARGUMENT", "workItemId must be a UUID.", 400);
  }
  const client = createAdminSupabaseClient();
  const { data, error } = await client
    .from("theater_work_items")
    .select("*")
    .eq("id", parsedId.data)
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

function envelope(params: {
  tool: TheaterToolName;
  snapshot: TheaterSnapshot;
  extra: Record<string, unknown>;
  item?: TheaterWorkItemSnapshot | null;
}): Record<string, unknown> {
  const definition = getTheaterTool(params.tool);
  const item =
    params.item ??
    (typeof params.extra.workItemId === "string"
      ? params.snapshot.items.find((entry) => entry.id === params.extra.workItemId)
      : undefined);
  return {
    tool: params.tool,
    sideEffect: definition.sideEffect,
    idempotent: definition.idempotent,
    nextActions: item?.nextActions ?? params.snapshot.items.flatMap((entry) => entry.nextActions).slice(0, 8),
    workItem: item ?? null,
    provenance: item
      ? {
          workItemId: item.id,
          providerId: item.providerId,
          identity: item.identity,
          source: item.source,
          catalogBlocked: item.catalogBlocked,
        }
      : { sessionId: params.snapshot.sessionId, itemCount: params.snapshot.items.length },
    ...params.extra,
  };
}

export async function executeTheaterTool(params: {
  token: string;
  tool: string;
  input: Record<string, unknown>;
}): Promise<{ result: Record<string, unknown>; snapshot: TheaterSnapshot }> {
  const session = await loadSessionRow(params.token);
  assertSessionNotExpired(new Date(), session.expires_at);

  const toolParsed = theaterToolNameSchema.safeParse(params.tool);
  if (!toolParsed.success) {
    throw new TheaterSessionError("UNKNOWN_TOOL", `Unknown theater tool: ${params.tool}`, 400);
  }
  const tool = parseTheaterToolName(toolParsed.data);
  const definition = getTheaterTool(tool);
  const input = params.input;
  const workItemId = definition.requiresWorkItemId ? parseWorkItemId(input) : "";

  switch (tool) {
    case "begin_resolution": {
      const prepared: string[] = [];
      const awaitingSignature: string[] = [];
      const skippedBlocked: Array<{ id: string; reason: string }> = [];
      const skippedIneligible: Array<{ id: string; reason: string }> = [];

      let snapshot = await snapshotFrom(session);
      for (const item of snapshot.items) {
        if (item.catalogBlocked) {
          skippedBlocked.push({ id: item.id, reason: item.problem });
          continue;
        }
        if (
          item.status === "AWAITING_SIGNATURE" ||
          item.status === "APPROVED" ||
          item.status === "EXECUTED" ||
          item.status === "VERIFIED"
        ) {
          if (item.status === "AWAITING_SIGNATURE") {
            awaitingSignature.push(item.id);
          }
          continue;
        }
        if (item.status === "DENIED") {
          continue;
        }

        try {
          await executeTheaterTool({ token: params.token, tool: "inspect_counter", input: { workItemId: item.id } });
          await executeTheaterTool({ token: params.token, tool: "compute_entitlement", input: { workItemId: item.id } });
          await executeTheaterTool({ token: params.token, tool: "prepare_filing", input: { workItemId: item.id } });
          await executeTheaterTool({ token: params.token, tool: "request_signature", input: { workItemId: item.id } });
          prepared.push(item.id);
          awaitingSignature.push(item.id);
        } catch (error) {
          if (error instanceof TheaterSessionError && error.code === "NOT_ELIGIBLE") {
            skippedIneligible.push({ id: item.id, reason: error.message });
            continue;
          }
          throw error;
        }
      }

      snapshot = await snapshotFrom(session);
      await recordAudit({
        sessionId: session.id,
        eventType: "begin_resolution",
        payload: {
          prepared,
          awaitingSignature,
          skippedBlocked: skippedBlocked.map((entry) => entry.id),
        },
      });

      return {
        result: envelope({
          tool,
          snapshot,
          extra: {
            prepared,
            awaitingSignature,
            skippedBlocked,
            skippedIneligible,
            humanActionRequired: awaitingSignature.length > 0,
            nextHumanStep:
              awaitingSignature.length > 0
                ? "Sign the prepared amounts on this page. Then call continue_resolution."
                : "Nothing awaiting signature.",
          },
        }),
        snapshot,
      };
    }
    case "continue_resolution": {
      const verified: string[] = [];
      const failed: Array<{ id: string; reason: string }> = [];
      const stillAwaitingSignature: string[] = [];

      let snapshot = await snapshotFrom(session);
      for (const item of snapshot.items) {
        if (item.catalogBlocked) {
          continue;
        }
        if (item.status === "VERIFIED") {
          verified.push(item.id);
          continue;
        }
        if (item.status === "AWAITING_SIGNATURE" || item.status === "PREPARED" || item.status === "ENTITLED") {
          stillAwaitingSignature.push(item.id);
          continue;
        }
        if (item.status !== "APPROVED" && item.status !== "EXECUTED" && item.status !== "FAILED") {
          continue;
        }

        try {
          if (item.status === "APPROVED" || (item.status === "FAILED" && !item.lastMutationId)) {
            await executeTheaterTool({
              token: params.token,
              tool: "execute_filing",
              input: { workItemId: item.id },
            });
          }
          const verifiedResult = await executeTheaterTool({
            token: params.token,
            tool: "verify_filing",
            input: { workItemId: item.id },
          });
          const matched = (verifiedResult.result.verification as { matched?: boolean } | undefined)?.matched;
          if (matched) {
            verified.push(item.id);
          } else {
            failed.push({ id: item.id, reason: "Verification mismatch." });
          }
        } catch (error) {
          if (error instanceof TheaterPermissionError && error.code === "APPROVAL_REQUIRED") {
            stillAwaitingSignature.push(item.id);
            continue;
          }
          failed.push({
            id: item.id,
            reason: error instanceof Error ? error.message : "continue_resolution failed",
          });
        }
      }

      snapshot = await snapshotFrom(session);
      await recordAudit({
        sessionId: session.id,
        eventType: "continue_resolution",
        payload: { verified, failed: failed.map((entry) => entry.id), stillAwaitingSignature },
      });

      return {
        result: envelope({
          tool,
          snapshot,
          extra: {
            verified,
            failed,
            stillAwaitingSignature,
            humanActionRequired: stillAwaitingSignature.length > 0,
            nextHumanStep:
              stillAwaitingSignature.length > 0
                ? "Sign remaining amounts on this page, then call continue_resolution again."
                : failed.length > 0
                  ? "Some filings failed verification. Do not declare success."
                  : "All signed filings verified.",
          },
        }),
        snapshot,
      };
    }
    case "list_work_items": {
      const snapshot = await snapshotFrom(session);
      return {
        result: envelope({
          tool,
          snapshot,
          extra: {
            items: snapshot.items.map((item) => ({
              id: item.id,
              title: item.title,
              providerId: item.providerId,
              status: item.status,
              catalogBlocked: item.catalogBlocked,
              problem: item.problem,
              nextActions: item.nextActions,
              amount: item.proposal?.amount ?? item.entitlement?.amount ?? null,
            })),
          },
        }),
        snapshot,
      };
    }
    case "get_work_item": {
      const row = await loadItemOrThrow({ sessionId: session.id, workItemId });
      const snapshot = await snapshotFrom(session);
      const item = mapItem(row);
      return { result: envelope({ tool, snapshot, item, extra: { item } }), snapshot };
    }
    case "inspect_counter": {
      const row = await loadItemOrThrow({ sessionId: session.id, workItemId });
      const providerId = asProviderId(row.provider_id);
      const identity = asIdentity(row.identity);
      const counter = await inspectProvider(providerId, identity);
      const nextStatus = inspectNextStatus(asStatus(row.status));
      await createAdminSupabaseClient()
        .from("theater_work_items")
        .update({ counter, status: nextStatus })
        .eq("id", row.id)
        .eq("session_id", session.id);
      await recordAudit({
        sessionId: session.id,
        workItemId: row.id,
        eventType: "inspect_counter",
        payload: { providerId },
      });
      const snapshot = await snapshotFrom(session);
      const item = snapshot.items.find((entry) => entry.id === row.id) ?? null;
      return { result: envelope({ tool, snapshot, item, extra: { counter } }), snapshot };
    }
    case "compute_entitlement": {
      const row = await loadItemOrThrow({ sessionId: session.id, workItemId });
      const providerId = asProviderId(row.provider_id);
      const identity = asIdentity(row.identity);
      const entitlement = await computeEntitlement(providerId, identity);
      const nextStatus = entitleNextStatus(asStatus(row.status));
      await createAdminSupabaseClient()
        .from("theater_work_items")
        .update({ entitlement, status: nextStatus })
        .eq("id", row.id)
        .eq("session_id", session.id);
      await recordAudit({
        sessionId: session.id,
        workItemId: row.id,
        eventType: "compute_entitlement",
        payload: { outcome: entitlement.outcome, amount: entitlement.amount },
      });
      const snapshot = await snapshotFrom(session);
      const item = snapshot.items.find((entry) => entry.id === row.id) ?? null;
      return { result: envelope({ tool, snapshot, item, extra: { entitlement } }), snapshot };
    }
    case "prepare_filing": {
      const row = await loadItemOrThrow({ sessionId: session.id, workItemId });
      const status = asStatus(row.status);
      assertPrepareAllowed(status);
      if (prepareAction(status) === "replay") {
        const snapshot = await snapshotFrom(session);
        const item = snapshot.items.find((entry) => entry.id === row.id) ?? null;
        return {
          result: envelope({
            tool,
            snapshot,
            item,
            extra: { proposal: item?.proposal ?? asProposal(row.proposal), replay: true },
          }),
          snapshot,
        };
      }

      const providerId = asProviderId(row.provider_id);
      const identity = asIdentity(row.identity);
      const entitlement = asDecision(row.entitlement) ?? (await computeEntitlement(providerId, identity));
      if (!entitlement || entitlement.outcome !== "eligible" || !entitlement.amount) {
        throw new TheaterSessionError(
          "NOT_ELIGIBLE",
          entitlement?.reasons?.[0] ?? "Work item is not eligible to prepare.",
          409,
        );
      }

      const nextVersion = Number(row.proposal_version ?? 0) + 1;
      const { proposal, idempotencyKey } = buildProposal({
        sessionId: session.id,
        workItemId: row.id,
        providerId,
        identity,
        amount: entitlement.amount,
        currency: entitlement.currency,
        version: nextVersion,
      });

      await createAdminSupabaseClient()
        .from("theater_work_items")
        .update({
          entitlement,
          proposal,
          idempotency_key: idempotencyKey,
          proposal_version: nextVersion,
          status: "PREPARED",
        })
        .eq("id", row.id)
        .eq("session_id", session.id)
        .in("status", ["UNINSPECTED", "INSPECTED", "ENTITLED"]);

      await recordAudit({
        sessionId: session.id,
        workItemId: row.id,
        eventType: "prepare_filing",
        payload: { amount: proposal.amount, version: nextVersion },
      });

      const snapshot = await snapshotFrom(session);
      const item = snapshot.items.find((entry) => entry.id === row.id) ?? null;
      return { result: envelope({ tool, snapshot, item, extra: { proposal } }), snapshot };
    }
    case "request_signature": {
      const row = await loadItemOrThrow({ sessionId: session.id, workItemId });
      const status = asStatus(row.status);
      assertRequestSignatureAllowed(status);
      if (requestSignatureAction(status) === "replay") {
        const snapshot = await snapshotFrom(session);
        const item = snapshot.items.find((entry) => entry.id === row.id) ?? null;
        return { result: envelope({ tool, snapshot, item, extra: { replay: true } }), snapshot };
      }
      if (!asProposal(row.proposal)) {
        throw new TheaterSessionError("NOT_PREPARED", "Prepare the filing before requesting a signature.", 409);
      }
      await createAdminSupabaseClient()
        .from("theater_work_items")
        .update({
          status: "AWAITING_SIGNATURE",
        })
        .eq("id", row.id)
        .eq("session_id", session.id)
        .eq("status", "PREPARED");
      await recordAudit({
        sessionId: session.id,
        workItemId: row.id,
        eventType: "request_signature",
      });
      const snapshot = await snapshotFrom(session);
      const item = snapshot.items.find((entry) => entry.id === row.id) ?? null;
      return { result: envelope({ tool, snapshot, item, extra: { awaitingSignature: true } }), snapshot };
    }
    case "execute_filing": {
      const row = await loadItemOrThrow({ sessionId: session.id, workItemId });
      const providerId = asProviderId(row.provider_id);
      const identity = asIdentity(row.identity);
      const proposal = asProposal(row.proposal);
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

      const mode = executeMode({
        status: asStatus(row.status),
        lastMutationId: row.last_mutation_id,
      });

      if (mode === "replay" && row.last_mutation_id) {
        const snapshot = await snapshotFrom(session);
        const item = snapshot.items.find((entry) => entry.id === row.id) ?? null;
        return {
          result: envelope({
            tool,
            snapshot,
            item,
            extra: {
              mutation: { id: row.last_mutation_id, status: row.last_mutation_status },
              replay: true,
            },
          }),
          snapshot,
        };
      }

      const attemptCount = Number(row.attempt_count ?? 0) + 1;
      await createAdminSupabaseClient()
        .from("theater_work_items")
        .update({
          last_attempt_at: new Date().toISOString(),
          attempt_count: attemptCount,
        })
        .eq("id", row.id)
        .eq("session_id", session.id);

      let mutation: { id: string; status: string };
      try {
        mutation = await executeProviderMutation({
          providerId,
          identity,
          amount: proposal.amount,
          currency: proposal.currency,
          idempotencyKey,
        });
      } catch (error) {
        const lastError: TheaterLastError = {
          code: error instanceof TheaterSessionError || error instanceof TheaterPermissionError
            ? error.code
            : ((error as { code?: string }).code ?? "TOOL_FAILED"),
          message: error instanceof Error ? error.message : "Provider mutation failed.",
          at: new Date().toISOString(),
        };
        await createAdminSupabaseClient()
          .from("theater_work_items")
          .update({
            status: "FAILED",
            last_error: lastError,
          })
          .eq("id", row.id)
          .eq("session_id", session.id)
          .in("status", ["APPROVED", "FAILED"]);
        await recordAudit({
          sessionId: session.id,
          workItemId: row.id,
          eventType: "execute_filing_failed",
          payload: { code: lastError.code },
        });
        throw error;
      }

      const { data: executed, error: executeUpdateError } = await createAdminSupabaseClient()
        .from("theater_work_items")
        .update({
          status: "EXECUTED",
          last_mutation_id: mutation.id,
          last_mutation_status: mutation.status,
          last_error: null,
        })
        .eq("id", row.id)
        .eq("session_id", session.id)
        .in("status", ["APPROVED", "FAILED"])
        .select("id")
        .maybeSingle();

      if (executeUpdateError) {
        throw new Error(executeUpdateError.message);
      }

      if (!executed) {
        const latest = await loadItemOrThrow({ sessionId: session.id, workItemId: row.id });
        if (latest.last_mutation_id) {
          const snapshot = await snapshotFrom(session);
          const item = snapshot.items.find((entry) => entry.id === row.id) ?? null;
          return {
            result: envelope({
              tool,
              snapshot,
              item,
              extra: {
                mutation: { id: latest.last_mutation_id, status: latest.last_mutation_status },
                replay: true,
              },
            }),
            snapshot,
          };
        }
      }

      await recordAudit({
        sessionId: session.id,
        workItemId: row.id,
        eventType: "execute_filing",
        payload: { mutationId: mutation.id, status: mutation.status },
      });

      const snapshot = await snapshotFrom(session);
      const item = snapshot.items.find((entry) => entry.id === row.id) ?? null;
      return { result: envelope({ tool, snapshot, item, extra: { mutation } }), snapshot };
    }
    case "verify_filing": {
      const row = await loadItemOrThrow({ sessionId: session.id, workItemId });
      const providerId = asProviderId(row.provider_id);
      const identity = asIdentity(row.identity);
      const proposal = asProposal(row.proposal);
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
        expected: proposal.expectedVerification,
      });

      await createAdminSupabaseClient()
        .from("theater_work_items")
        .update({
          verification,
          status: verification.matched ? "VERIFIED" : "FAILED",
        })
        .eq("id", row.id)
        .eq("session_id", session.id);

      await recordAudit({
        sessionId: session.id,
        workItemId: row.id,
        eventType: verification.matched ? "verify_filing_matched" : "verify_filing_mismatch",
        payload: { matched: verification.matched, mutationId },
      });

      const snapshot = await snapshotFrom(session);
      const item = snapshot.items.find((entry) => entry.id === row.id) ?? null;
      return { result: envelope({ tool, snapshot, item, extra: { verification } }), snapshot };
    }
    default: {
      const exhaustive: never = tool;
      throw new TheaterSessionError("UNKNOWN_TOOL", `Unknown theater tool: ${exhaustive}`, 400);
    }
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

async function computeEntitlement(
  providerId: TheaterProviderId,
  identity: TheaterWorkItemIdentity,
): Promise<EligibilityDecision> {
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
  version: number;
}): { proposal: TheaterProposal; idempotencyKey: string } {
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
        version: params.version,
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
        version: params.version,
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
      version: params.version,
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
}): Promise<{ id: string; status: string }> {
  if (params.providerId === "flyright" && params.identity.providerId === "flyright") {
    const flyright = createFlyRightProvider();
    const claim = await flyright.submitClaim({
      locator: params.identity.locator,
      lastName: params.identity.lastName,
      amount: params.amount,
      currency: params.currency,
      idempotencyKey: params.idempotencyKey,
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
  });
  return { id: claim.id, status: claim.status };
}

async function verifyProviderMutation(params: {
  providerId: TheaterProviderId;
  identity: TheaterWorkItemIdentity;
  mutationId: string;
  amount: string;
  currency: string;
  expected: Record<string, unknown>;
}): Promise<NonNullable<TheaterWorkItemSnapshot["verification"]>> {
  if (params.providerId === "flyright" && params.identity.providerId === "flyright") {
    const flyright = createFlyRightProvider();
    const observed = await flyright.getClaimStatus(params.mutationId);
    const expectedLocator = String(params.expected.locator ?? params.identity.locator);
    const expectedAmount = String(params.expected.amount ?? params.amount);
    const expectedCurrency = String(params.expected.currency ?? params.currency);
    const matched =
      observed.id === params.mutationId &&
      observed.locator === expectedLocator &&
      observed.amount === expectedAmount &&
      observed.currency === expectedCurrency;
    return {
      expected: {
        claimId: params.mutationId,
        locator: expectedLocator,
        amount: expectedAmount,
        currency: expectedCurrency,
      },
      observed: { ...observed },
      matched,
    };
  }

  if (params.providerId === "streamly" && params.identity.providerId === "streamly") {
    const streamly = createStreamlyProvider();
    const observed = await streamly.getRefundStatus(params.mutationId);
    const expectedSubscriptionId = String(params.expected.subscriptionId ?? params.identity.subscriptionId);
    const expectedAmount = String(params.expected.amount ?? params.amount);
    const expectedCurrency = String(params.expected.currency ?? params.currency);
    const matched =
      observed.id === params.mutationId &&
      observed.subscriptionId === expectedSubscriptionId &&
      observed.amount === expectedAmount &&
      observed.currency === expectedCurrency;
    return {
      expected: {
        refundId: params.mutationId,
        subscriptionId: expectedSubscriptionId,
        amount: expectedAmount,
        currency: expectedCurrency,
      },
      observed: { ...observed },
      matched,
    };
  }

  const electromart = createElectroMartProvider();
  if (params.identity.providerId !== "electromart") {
    throw new TheaterSessionError("IDENTITY_MISMATCH", "Identity does not match the work item provider.", 500);
  }
  const observed = await electromart.getClaimStatus(params.mutationId);
  const expectedOrderId = String(params.expected.orderId ?? params.identity.orderId);
  const expectedAmount = String(params.expected.amount ?? params.amount);
  const expectedCurrency = String(params.expected.currency ?? params.currency);
  const matched =
    observed.id === params.mutationId &&
    observed.orderId === expectedOrderId &&
    observed.amount === expectedAmount &&
    observed.currency === expectedCurrency;
  return {
    expected: {
      claimId: params.mutationId,
      orderId: expectedOrderId,
      amount: expectedAmount,
      currency: expectedCurrency,
    },
    observed: { ...observed },
    matched,
  };
}

export { TheaterPermissionError };
