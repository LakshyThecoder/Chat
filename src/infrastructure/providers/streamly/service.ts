import "server-only";

import { randomBytes } from "crypto";
import { createAdminSupabaseClient } from "@/src/infrastructure/db/supabase/admin";
import { evaluateSubscriptionRefund } from "@/src/domain/eligibility/evaluate-subscription-refund";
import { normalizeSqlMoney } from "@/src/domain/money/cents";
import {
  StreamlyConflictError,
  StreamlyNotFoundError,
  type StreamlyRefund,
  type StreamlyRefundStatus,
  type StreamlySubscription,
  type StreamlySubscriptionStatus,
} from "@/src/infrastructure/providers/streamly/types";

function normalizeSubscriptionId(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function mapSubscription(row: Record<string, unknown>): StreamlySubscription {
  return {
    id: String(row.id),
    subscriptionId: String(row.subscription_id),
    accountEmail: String(row.account_email),
    planName: String(row.plan_name),
    monthlyPrice: normalizeSqlMoney(row.monthly_price),
    currency: String(row.currency),
    status: row.status as StreamlySubscriptionStatus,
    cancelledAt: row.cancelled_at ? String(row.cancelled_at) : null,
    lastChargedAt: String(row.last_charged_at),
    lastChargeAmount: normalizeSqlMoney(row.last_charge_amount),
  };
}

function mapRefund(row: Record<string, unknown>): StreamlyRefund {
  return {
    id: String(row.id),
    subscriptionUuid: String(row.subscription_uuid),
    subscriptionId: String(row.subscription_id),
    amount: normalizeSqlMoney(row.amount),
    currency: String(row.currency),
    status: row.status as StreamlyRefundStatus,
    idempotencyKey: String(row.idempotency_key),
    aegisCaseId: row.aegis_case_id ? String(row.aegis_case_id) : null,
    createdAt: String(row.created_at),
  };
}

const THEATER_TEMPLATE = {
  subscriptionId: "SL-1001",
  accountEmail: "camille.moreau@example.com",
} as const;

export class StreamlyProvider {
  constructor(private readonly client = createAdminSupabaseClient()) {}

  async getSubscription(subscriptionId: string, accountEmail: string): Promise<StreamlySubscription> {
    const { data, error } = await this.client
      .from("streamly_subscriptions")
      .select("*")
      .eq("subscription_id", normalizeSubscriptionId(subscriptionId))
      .eq("account_email", normalizeEmail(accountEmail))
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      throw new StreamlyNotFoundError();
    }
    return mapSubscription(data);
  }

  async getBillingHistory(subscriptionId: string, accountEmail: string) {
    const subscription = await this.getSubscription(subscriptionId, accountEmail);
    return {
      subscriptionId: subscription.subscriptionId,
      lastChargedAt: subscription.lastChargedAt,
      lastChargeAmount: subscription.lastChargeAmount,
      currency: subscription.currency,
      status: subscription.status,
      cancelledAt: subscription.cancelledAt,
    };
  }

  async getCancellationPolicy() {
    const { data, error } = await this.client
      .from("provider_policies")
      .select("*")
      .eq("provider", "streamly")
      .eq("policy_key", "billed_after_cancel")
      .eq("version", "2026.09")
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      throw new Error("Streamly policy is not published.");
    }

    return {
      id: String(data.id),
      provider: String(data.provider),
      policyKey: String(data.policy_key),
      version: String(data.version),
      title: String(data.title),
      body: String(data.body),
    };
  }

  async getRefundForSubscription(subscriptionId: string): Promise<StreamlyRefund | null> {
    const { data, error } = await this.client
      .from("streamly_refunds")
      .select("*")
      .eq("subscription_id", normalizeSubscriptionId(subscriptionId))
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    return data ? mapRefund(data) : null;
  }

  async calculateRefund(subscriptionId: string, accountEmail: string) {
    const subscription = await this.getSubscription(subscriptionId, accountEmail);
    const existing = await this.getRefundForSubscription(subscription.subscriptionId);
    const decision = evaluateSubscriptionRefund({
      subscriptionFound: true,
      status: subscription.status,
      cancelledAt: subscription.cancelledAt,
      lastChargedAt: subscription.lastChargedAt,
      lastChargeAmount: subscription.lastChargeAmount,
      currency: subscription.currency,
      existingRefund: Boolean(existing),
    });

    return {
      subscriptionId: subscription.subscriptionId,
      outcome: decision.outcome,
      amount: decision.amount,
      currency: decision.currency,
      reasons: decision.reasons,
      ruleIds: decision.ruleIds,
    };
  }

  async cancelSubscription(params: {
    subscriptionId: string;
    accountEmail: string;
  }): Promise<StreamlySubscription> {
    const subscription = await this.getSubscription(params.subscriptionId, params.accountEmail);
    if (subscription.status === "cancelled") {
      return subscription;
    }

    const cancelledAt = new Date().toISOString();
    const { data, error } = await this.client
      .from("streamly_subscriptions")
      .update({ status: "cancelled", cancelled_at: cancelledAt })
      .eq("id", subscription.id)
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Cancellation failed");
    }
    return mapSubscription(data);
  }

  async requestRefund(params: {
    subscriptionId: string;
    accountEmail: string;
    amount: string;
    currency: string;
    idempotencyKey: string;
    aegisCaseId?: string;
  }): Promise<StreamlyRefund> {
    const existingByKey = await this.client
      .from("streamly_refunds")
      .select("*")
      .eq("idempotency_key", params.idempotencyKey)
      .maybeSingle();

    if (existingByKey.error) {
      throw new Error(existingByKey.error.message);
    }
    if (existingByKey.data) {
      return mapRefund(existingByKey.data);
    }

    const subscription = await this.getSubscription(params.subscriptionId, params.accountEmail);
    const compensation = await this.calculateRefund(params.subscriptionId, params.accountEmail);

    if (compensation.outcome !== "eligible" || !compensation.amount) {
      throw new StreamlyConflictError(
        compensation.reasons[0] ?? "Subscription is not eligible for a billed-after-cancel refund.",
      );
    }

    if (compensation.amount !== params.amount || compensation.currency !== params.currency) {
      throw new StreamlyConflictError("Submitted amount does not match the Streamly calculation.");
    }

    const { data, error } = await this.client
      .from("streamly_refunds")
      .insert({
        subscription_uuid: subscription.id,
        subscription_id: subscription.subscriptionId,
        amount: params.amount,
        currency: params.currency,
        status: "OPEN",
        idempotency_key: params.idempotencyKey,
        aegis_case_id: params.aegisCaseId ?? null,
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        const replay = await this.getRefundForSubscription(subscription.subscriptionId);
        if (replay) {
          return replay;
        }
        throw new StreamlyConflictError("A refund already exists for this subscription.");
      }
      throw new Error(error.message);
    }

    return mapRefund(data);
  }

  async getRefundStatus(refundId: string): Promise<StreamlyRefund> {
    const { data, error } = await this.client
      .from("streamly_refunds")
      .select("*")
      .eq("id", refundId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      throw new StreamlyNotFoundError();
    }
    return mapRefund(data);
  }

  async issueTheaterSubscription(): Promise<StreamlySubscription> {
    const template = await this.getSubscription(THEATER_TEMPLATE.subscriptionId, THEATER_TEMPLATE.accountEmail);

    const cancelledAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const lastChargedAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const suffix = randomBytes(3).toString("hex").toUpperCase();
      const subscriptionId = `SL-${suffix}`;
      const { data, error } = await this.client
        .from("streamly_subscriptions")
        .insert({
          subscription_id: subscriptionId,
          account_email: template.accountEmail,
          plan_name: template.planName,
          monthly_price: template.monthlyPrice,
          currency: template.currency,
          status: "cancelled",
          cancelled_at: cancelledAt,
          last_charged_at: lastChargedAt,
          last_charge_amount: template.lastChargeAmount,
        })
        .select("*")
        .single();

      if (!error && data) {
        return mapSubscription(data);
      }
      if (error?.code === "23505") {
        continue;
      }
      throw new Error(error?.message ?? "Streamly could not issue a theater subscription.");
    }

    throw new Error("Streamly could not issue a unique theater subscription.");
  }
}

export function createStreamlyProvider() {
  return new StreamlyProvider();
}
