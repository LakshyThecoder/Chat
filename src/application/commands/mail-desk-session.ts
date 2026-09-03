import "server-only";

import { createHash, randomBytes } from "crypto";
import { createAdminSupabaseClient } from "@/src/infrastructure/db/supabase/admin";
import { buildSupportDraft, evaluateBilledAfterCancel } from "@/src/domain/mail-desk/entitlement";
import { MailDeskError, MailDeskPermissionError } from "@/src/domain/mail-desk/errors";
import {
  getMailDeskTool,
  parseMailDeskItemId,
  parseMailDeskToolName,
  type MailDeskToolName,
} from "@/src/domain/mail-desk/tools";
import type {
  MailDeskBill,
  MailDeskDraft,
  MailDeskItemSnapshot,
  MailDeskPolicy,
  MailDeskSnapshot,
  MailDeskStatus,
  MailDeskVerification,
} from "@/src/domain/mail-desk/types";

export const MAIL_DESK_COOKIE = "aegis_mail_desk";
const SESSION_TTL_MS = 1000 * 60 * 60 * 4;
const DISPUTE_KEYS = ["mail-codeforge-pro", "mail-streamly-charge"] as const;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeMoney(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
}

export function mailDeskCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 4,
  };
}

async function recordAudit(params: {
  sessionId: string;
  itemId?: string | null;
  eventType: string;
  payload?: Record<string, unknown>;
}) {
  await createAdminSupabaseClient().from("mail_desk_audit_events").insert({
    session_id: params.sessionId,
    item_id: params.itemId ?? null,
    event_type: params.eventType,
    payload: params.payload ?? {},
  });
}

function nextActions(status: MailDeskStatus): string[] {
  switch (status) {
    case "DETECTED":
      return ["import_bill"];
    case "BILL_IMPORTED":
      return ["lookup_refund_policy"];
    case "POLICY_CHECKED":
      return ["prepare_support_email"];
    case "DRAFTED":
      return ["request_mail_signature"];
    case "AWAITING_SIGNATURE":
      return ["human_sign"];
    case "APPROVED":
      return ["send_support_email"];
    case "SENT":
      return ["verify_sent"];
    case "VERIFIED":
      return [];
    default:
      return [];
  }
}

function mapItem(row: Record<string, unknown>, mailMeta?: { hint: string; fromAddress: string; subject: string }): MailDeskItemSnapshot {
  const status = row.status as MailDeskStatus;
  const bill = (row.bill as MailDeskBill | null) ?? null;
  const draft = (row.draft as MailDeskDraft | null) ?? null;
  return {
    id: String(row.id),
    messageKey: String(row.message_key),
    title: String(row.title),
    merchant: String(row.merchant),
    status,
    hint: mailMeta?.hint ?? "",
    fromAddress: mailMeta?.fromAddress ?? "",
    subject: mailMeta?.subject ?? String(row.title),
    bill,
    policy: (row.policy as MailDeskPolicy | null) ?? null,
    draft,
    approval: {
      state: row.denied_at ? "denied" : row.approved_at ? "approved" : "unsigned",
      approvedAmount: row.approved_amount != null ? normalizeMoney(row.approved_amount) : null,
      approvedCurrency: row.approved_currency ? String(row.approved_currency) : null,
    },
    outboundId: row.outbound_id ? String(row.outbound_id) : null,
    verification: (row.verification as MailDeskVerification | null) ?? null,
    nextActions: nextActions(status),
  };
}

async function loadMailMeta(messageKey: string) {
  const { data } = await createAdminSupabaseClient()
    .from("mail_messages")
    .select("hint, from_address, subject, body")
    .eq("message_key", messageKey)
    .maybeSingle();
  return {
    hint: data ? String(data.hint) : "",
    fromAddress: data ? String(data.from_address) : "",
    subject: data ? String(data.subject) : "",
    body: data ? String(data.body) : "",
  };
}

async function snapshotFrom(sessionId: string, expiresAt: string): Promise<MailDeskSnapshot> {
  const client = createAdminSupabaseClient();
  const { data: items, error } = await client
    .from("mail_desk_items")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw new MailDeskError("SNAPSHOT_FAILED", error.message, 500);

  const mapped: MailDeskItemSnapshot[] = [];
  for (const row of items ?? []) {
    const meta = await loadMailMeta(String(row.message_key));
    mapped.push(mapItem(row as Record<string, unknown>, meta));
  }

  return {
    sessionId,
    expiresAt,
    expired: Date.parse(expiresAt) <= Date.now(),
    items: mapped,
  };
}

async function requireSession(token: string) {
  const client = createAdminSupabaseClient();
  const { data, error } = await client
    .from("mail_desk_sessions")
    .select("*")
    .eq("token_hash", hashToken(token))
    .is("superseded_at", null)
    .maybeSingle();
  if (error) throw new MailDeskError("SESSION_LOOKUP", error.message, 500);
  if (!data) throw new MailDeskError("MAIL_DESK_NOT_FOUND", "No mail desk session on this browser.", 404);
  if (Date.parse(String(data.expires_at)) <= Date.now()) {
    throw new MailDeskError("MAIL_DESK_EXPIRED", "Mail desk session expired. Open a new session.", 409);
  }
  return data as { id: string; expires_at: string };
}

async function loadItem(sessionId: string, itemId: string) {
  const { data, error } = await createAdminSupabaseClient()
    .from("mail_desk_items")
    .select("*")
    .eq("session_id", sessionId)
    .eq("id", itemId)
    .maybeSingle();
  if (error) throw new MailDeskError("ITEM_LOOKUP", error.message, 500);
  if (!data) throw new MailDeskError("ITEM_NOT_FOUND", "Mail dispute not found.", 404);
  return data as Record<string, unknown>;
}

export async function createMailDeskSession(options?: { previousToken?: string | null }) {
  const client = createAdminSupabaseClient();
  if (options?.previousToken) {
    await client
      .from("mail_desk_sessions")
      .update({ superseded_at: new Date().toISOString() })
      .eq("token_hash", hashToken(options.previousToken))
      .is("superseded_at", null);
  }

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const { data: session, error } = await client
    .from("mail_desk_sessions")
    .insert({ token_hash: hashToken(token), expires_at: expiresAt })
    .select("*")
    .single();
  if (error || !session) throw new MailDeskError("SESSION_CREATE", error?.message ?? "Could not open mail desk.", 500);

  for (const messageKey of DISPUTE_KEYS) {
    const meta = await loadMailMeta(messageKey);
    if (!meta.subject) continue;
    const billRow = await client.from("mail_bill_catalog").select("*").eq("message_key", messageKey).maybeSingle();
    const merchant = billRow.data ? String(billRow.data.merchant) : messageKey.includes("streamly") ? "Streamly" : "CodeForge";
    await client.from("mail_desk_items").insert({
      session_id: session.id,
      message_key: messageKey,
      title: meta.subject,
      merchant,
      status: "DETECTED",
    });
  }

  await recordAudit({ sessionId: session.id, eventType: "session_created" });
  const snapshot = await snapshotFrom(session.id, expiresAt);
  return { token, snapshot };
}

export async function getMailDeskSnapshot(token: string) {
  const session = await requireSession(token);
  return snapshotFrom(session.id, String(session.expires_at));
}

export async function decideMailDeskItem(params: {
  token: string;
  itemId: string;
  decision: "approved" | "denied";
}) {
  const session = await requireSession(params.token);
  const item = await loadItem(session.id, params.itemId);
  if (String(item.status) !== "AWAITING_SIGNATURE") {
    throw new MailDeskError("NOT_AWAITING", "Nothing awaiting signature on this dispute.", 409);
  }
  const draft = item.draft as MailDeskDraft | null;
  if (!draft && params.decision === "approved") {
    throw new MailDeskError("NOT_DRAFTED", "Prepare the support email before signing.", 409);
  }

  const client = createAdminSupabaseClient();
  if (params.decision === "denied") {
    await client
      .from("mail_desk_items")
      .update({ status: "DENIED", denied_at: new Date().toISOString() })
      .eq("id", item.id)
      .eq("session_id", session.id);
    await recordAudit({ sessionId: session.id, itemId: String(item.id), eventType: "denied" });
  } else {
    await client
      .from("mail_desk_items")
      .update({
        status: "APPROVED",
        approved_amount: draft!.amount,
        approved_currency: draft!.currency,
        approved_at: new Date().toISOString(),
        denied_at: null,
      })
      .eq("id", item.id)
      .eq("session_id", session.id);
    await recordAudit({
      sessionId: session.id,
      itemId: String(item.id),
      eventType: "approved",
      payload: { amount: draft!.amount, currency: draft!.currency },
    });
  }

  return snapshotFrom(session.id, String(session.expires_at));
}

function envelope(tool: MailDeskToolName, snapshot: MailDeskSnapshot, extra: Record<string, unknown>) {
  const definition = getMailDeskTool(tool);
  return {
    tool,
    sideEffect: definition.sideEffect,
    idempotent: definition.idempotent,
    ...extra,
    desk: snapshot,
  };
}

export async function executeMailDeskTool(params: {
  token: string;
  tool: string;
  input: Record<string, unknown>;
}) {
  const session = await requireSession(params.token);
  const tool = parseMailDeskToolName(params.tool);
  const definition = getMailDeskTool(tool);
  const itemId = definition.requiresItemId ? parseMailDeskItemId(params.input) : "";
  const client = createAdminSupabaseClient();

  switch (tool) {
    case "begin_mail_resolution": {
      let snapshot = await snapshotFrom(session.id, String(session.expires_at));
      const prepared: string[] = [];
      const skipped: Array<{ id: string; reason: string }> = [];
      for (const item of snapshot.items) {
        if (
          item.status === "AWAITING_SIGNATURE" ||
          item.status === "APPROVED" ||
          item.status === "SENT" ||
          item.status === "VERIFIED"
        ) {
          if (item.status === "AWAITING_SIGNATURE") prepared.push(item.id);
          continue;
        }
        if (item.status === "DENIED") continue;
        try {
          await executeMailDeskTool({ token: params.token, tool: "import_bill", input: { itemId: item.id } });
          await executeMailDeskTool({
            token: params.token,
            tool: "lookup_refund_policy",
            input: { itemId: item.id },
          });
          await executeMailDeskTool({
            token: params.token,
            tool: "prepare_support_email",
            input: { itemId: item.id },
          });
          await executeMailDeskTool({
            token: params.token,
            tool: "request_mail_signature",
            input: { itemId: item.id },
          });
          prepared.push(item.id);
        } catch (error) {
          if (
            error instanceof MailDeskError &&
            (error.code === "NOT_ELIGIBLE" || error.code === "NO_BILL" || error.code === "NOT_READY")
          ) {
            skipped.push({ id: item.id, reason: error.message });
            continue;
          }
          throw error;
        }
      }
      snapshot = await snapshotFrom(session.id, String(session.expires_at));
      await recordAudit({
        sessionId: session.id,
        eventType: "begin_mail_resolution",
        payload: { prepared, skipped },
      });
      return {
        result: envelope(tool, snapshot, {
          prepared,
          skipped,
          humanActionRequired: snapshot.items.some((i) => i.status === "AWAITING_SIGNATURE"),
          nextHumanStep:
            "Sign the refund amount on this page, then call send_support_email (or Send signed email).",
        }),
        snapshot,
      };
    }
    case "list_mail_disputes": {
      const snapshot = await snapshotFrom(session.id, String(session.expires_at));
      return {
        result: envelope(tool, snapshot, {
          items: snapshot.items.map((item) => ({
            id: item.id,
            title: item.title,
            merchant: item.merchant,
            status: item.status,
            amount: item.draft?.amount ?? item.bill?.amount ?? null,
          })),
        }),
        snapshot,
      };
    }
    case "inspect_mail": {
      const item = await loadItem(session.id, itemId);
      const meta = await loadMailMeta(String(item.message_key));
      const snapshot = await snapshotFrom(session.id, String(session.expires_at));
      return {
        result: envelope(tool, snapshot, {
          item: mapItem(item, meta),
          message: meta,
        }),
        snapshot,
      };
    }
    case "import_bill": {
      const item = await loadItem(session.id, itemId);
      if (item.bill && ["BILL_IMPORTED", "POLICY_CHECKED", "DRAFTED", "AWAITING_SIGNATURE", "APPROVED", "SENT", "VERIFIED"].includes(String(item.status))) {
        const snapshot = await snapshotFrom(session.id, String(session.expires_at));
        return { result: envelope(tool, snapshot, { bill: item.bill, replay: true }), snapshot };
      }
      const { data: billRow, error } = await client
        .from("mail_bill_catalog")
        .select("*")
        .eq("message_key", String(item.message_key))
        .maybeSingle();
      if (error) throw new MailDeskError("BILL_LOOKUP", error.message, 500);
      if (!billRow) throw new MailDeskError("NO_BILL", "No bill attachment on this message.", 409);

      const bill: MailDeskBill = {
        messageKey: String(billRow.message_key),
        filename: String(billRow.filename),
        merchant: String(billRow.merchant),
        invoiceId: String(billRow.invoice_id),
        amount: normalizeMoney(billRow.amount),
        currency: String(billRow.currency),
        billedAt: String(billRow.billed_at),
        cancelledAt: billRow.cancelled_at ? String(billRow.cancelled_at) : null,
        planName: String(billRow.plan_name),
        supportAddress: String(billRow.support_address),
        bodyText: String(billRow.body_text),
      };

      await client
        .from("mail_desk_items")
        .update({ bill, status: "BILL_IMPORTED", merchant: bill.merchant })
        .eq("id", item.id)
        .eq("session_id", session.id);
      await recordAudit({ sessionId: session.id, itemId: String(item.id), eventType: "import_bill", payload: { invoiceId: bill.invoiceId } });
      const snapshot = await snapshotFrom(session.id, String(session.expires_at));
      return { result: envelope(tool, snapshot, { bill }), snapshot };
    }
    case "lookup_refund_policy": {
      const item = await loadItem(session.id, itemId);
      const bill = item.bill as MailDeskBill | null;
      if (!bill) throw new MailDeskError("NO_BILL", "Import the bill before policy lookup.", 409);

      const provider = bill.merchant.toLowerCase() === "streamly" ? "streamly" : "codeforge";
      const { data: policyRow, error } = await client
        .from("provider_policies")
        .select("*")
        .eq("provider", provider)
        .eq("policy_key", "billed_after_cancel")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new MailDeskError("POLICY_LOOKUP", error.message, 500);
      if (!policyRow) throw new MailDeskError("NO_POLICY", "No refund policy found for this merchant.", 404);

      const policy: MailDeskPolicy = {
        provider: String(policyRow.provider),
        policyKey: String(policyRow.policy_key),
        version: String(policyRow.version),
        title: String(policyRow.title),
        body: String(policyRow.body),
        source: `provider_policies:${policyRow.provider}/${policyRow.policy_key}@${policyRow.version}`,
      };

      const eligibility = evaluateBilledAfterCancel({ bill, policy });
      await client
        .from("mail_desk_items")
        .update({
          policy: { ...policy, eligibility },
          status: "POLICY_CHECKED",
        })
        .eq("id", item.id)
        .eq("session_id", session.id);
      await recordAudit({
        sessionId: session.id,
        itemId: String(item.id),
        eventType: "lookup_refund_policy",
        payload: { eligible: eligibility.eligible },
      });
      const snapshot = await snapshotFrom(session.id, String(session.expires_at));
      return { result: envelope(tool, snapshot, { policy, eligibility }), snapshot };
    }
    case "prepare_support_email": {
      const item = await loadItem(session.id, itemId);
      if (item.draft && ["DRAFTED", "AWAITING_SIGNATURE", "APPROVED", "SENT", "VERIFIED"].includes(String(item.status))) {
        const snapshot = await snapshotFrom(session.id, String(session.expires_at));
        return { result: envelope(tool, snapshot, { draft: item.draft, replay: true }), snapshot };
      }
      const bill = item.bill as MailDeskBill | null;
      const policyBag = item.policy as (MailDeskPolicy & { eligibility?: ReturnType<typeof evaluateBilledAfterCancel> }) | null;
      if (!bill || !policyBag) throw new MailDeskError("NOT_READY", "Import bill and look up policy first.", 409);
      const { eligibility: _e, ...policy } = policyBag;
      const eligibility =
        policyBag.eligibility ?? evaluateBilledAfterCancel({ bill, policy });
      if (!eligibility.eligible) {
        throw new MailDeskError("NOT_ELIGIBLE", eligibility.reasons[0] ?? "Not eligible to file.", 409);
      }
      const draft = buildSupportDraft({ bill, policy, eligibility });
      const idempotencyKey = `mail-desk:${session.id}:${item.id}:send`;
      await client
        .from("mail_desk_items")
        .update({ draft, status: "DRAFTED", idempotency_key: idempotencyKey })
        .eq("id", item.id)
        .eq("session_id", session.id)
        .in("status", ["POLICY_CHECKED", "DRAFTED", "BILL_IMPORTED"]);
      await recordAudit({ sessionId: session.id, itemId: String(item.id), eventType: "prepare_support_email" });
      const snapshot = await snapshotFrom(session.id, String(session.expires_at));
      return { result: envelope(tool, snapshot, { draft }), snapshot };
    }
    case "request_mail_signature": {
      const item = await loadItem(session.id, itemId);
      if (String(item.status) === "AWAITING_SIGNATURE" || String(item.status) === "APPROVED") {
        const snapshot = await snapshotFrom(session.id, String(session.expires_at));
        return { result: envelope(tool, snapshot, { replay: true }), snapshot };
      }
      if (!item.draft) throw new MailDeskError("NOT_DRAFTED", "Prepare the support email first.", 409);
      await client
        .from("mail_desk_items")
        .update({ status: "AWAITING_SIGNATURE" })
        .eq("id", item.id)
        .eq("session_id", session.id)
        .eq("status", "DRAFTED");
      await recordAudit({ sessionId: session.id, itemId: String(item.id), eventType: "request_mail_signature" });
      const snapshot = await snapshotFrom(session.id, String(session.expires_at));
      return { result: envelope(tool, snapshot, { awaitingSignature: true }), snapshot };
    }
    case "send_support_email": {
      const item = await loadItem(session.id, itemId);
      if (String(item.status) === "DENIED") {
        throw new MailDeskPermissionError("DENIED", "Human denied this outbound email.");
      }
      if (String(item.status) !== "APPROVED" && String(item.status) !== "SENT" && String(item.status) !== "VERIFIED") {
        throw new MailDeskPermissionError(
          "APPROVAL_REQUIRED",
          "Sign the refund amount on this page before send_support_email.",
        );
      }
      const draft = item.draft as MailDeskDraft | null;
      if (!draft) throw new MailDeskError("NOT_DRAFTED", "Missing draft.", 409);
      if (
        item.approved_amount != null &&
        normalizeMoney(item.approved_amount) !== normalizeMoney(draft.amount)
      ) {
        throw new MailDeskError("AMOUNT_MISMATCH", "Signed amount does not match the draft.", 409);
      }
      if (item.outbound_id && (String(item.status) === "SENT" || String(item.status) === "VERIFIED")) {
        const snapshot = await snapshotFrom(session.id, String(session.expires_at));
        return {
          result: envelope(tool, snapshot, {
            mutation: { id: item.outbound_id, status: "SENT" },
            replay: true,
          }),
          snapshot,
        };
      }

      const idempotencyKey = String(item.idempotency_key ?? `mail-desk:${session.id}:${item.id}:send`);
      const existing = await client.from("outbound_mail").select("*").eq("idempotency_key", idempotencyKey).maybeSingle();
      let outboundId = existing.data?.id as string | undefined;
      if (!outboundId) {
        const providerMessageId = `sandbox-${randomBytes(6).toString("hex")}`;
        const { data: inserted, error } = await client
          .from("outbound_mail")
          .insert({
            session_id: session.id,
            item_id: item.id,
            to_address: draft.toAddress,
            subject: draft.subject,
            body: draft.body,
            amount: draft.amount,
            currency: draft.currency,
            idempotency_key: idempotencyKey,
            status: "SENT",
            provider_message_id: providerMessageId,
          })
          .select("*")
          .single();
        if (error) {
          const replay = await client.from("outbound_mail").select("*").eq("idempotency_key", idempotencyKey).maybeSingle();
          if (!replay.data) throw new MailDeskError("SEND_FAILED", error.message, 500);
          outboundId = String(replay.data.id);
        } else {
          outboundId = String(inserted.id);
        }
      }

      await client
        .from("mail_desk_items")
        .update({
          status: "SENT",
          outbound_id: outboundId,
          attempt_count: Number(item.attempt_count ?? 0) + 1,
          last_error: null,
        })
        .eq("id", item.id)
        .eq("session_id", session.id);
      await recordAudit({
        sessionId: session.id,
        itemId: String(item.id),
        eventType: "send_support_email",
        payload: { outboundId },
      });
      const snapshot = await snapshotFrom(session.id, String(session.expires_at));
      return { result: envelope(tool, snapshot, { mutation: { id: outboundId, status: "SENT" } }), snapshot };
    }
    case "verify_sent": {
      const item = await loadItem(session.id, itemId);
      const draft = item.draft as MailDeskDraft | null;
      if (!draft || !item.outbound_id) {
        throw new MailDeskError("NO_MUTATION", "Send the support email before verify_sent.", 409);
      }
      const { data: outbound, error } = await client.from("outbound_mail").select("*").eq("id", item.outbound_id).maybeSingle();
      if (error) throw new MailDeskError("VERIFY_LOOKUP", error.message, 500);
      if (!outbound) throw new MailDeskError("NO_MUTATION", "Outbound mail record missing.", 409);

      const expected = {
        toAddress: draft.toAddress,
        amount: draft.amount,
        currency: draft.currency,
        subject: draft.subject,
        status: "SENT",
      };
      const observed = {
        toAddress: String(outbound.to_address),
        amount: normalizeMoney(outbound.amount),
        currency: String(outbound.currency),
        subject: String(outbound.subject),
        status: String(outbound.status),
        providerMessageId: outbound.provider_message_id,
      };
      const matched =
        expected.toAddress === observed.toAddress &&
        expected.amount === observed.amount &&
        expected.currency === observed.currency &&
        expected.subject === observed.subject &&
        observed.status === "SENT";

      const verification: MailDeskVerification = { matched, expected, observed };
      await client
        .from("mail_desk_items")
        .update({
          verification,
          status: matched ? "VERIFIED" : "FAILED",
        })
        .eq("id", item.id)
        .eq("session_id", session.id);
      await recordAudit({
        sessionId: session.id,
        itemId: String(item.id),
        eventType: "verify_sent",
        payload: { matched },
      });
      const snapshot = await snapshotFrom(session.id, String(session.expires_at));
      return { result: envelope(tool, snapshot, { verification }), snapshot };
    }
    default: {
      const exhaustive: never = tool;
      throw new MailDeskError("UNKNOWN_TOOL", `Unknown tool: ${exhaustive}`, 400);
    }
  }
}
