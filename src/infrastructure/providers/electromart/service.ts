import "server-only";

import { randomBytes } from "crypto";
import { createAdminSupabaseClient } from "@/src/infrastructure/db/supabase/admin";
import { evaluateWarrantyClaim, warrantyEndsAt } from "@/src/domain/eligibility/evaluate-warranty-claim";
import { normalizeSqlMoney } from "@/src/domain/money/cents";
import {
  ElectroMartConflictError,
  ElectroMartNotFoundError,
  type ElectroMartClaim,
  type ElectroMartClaimStatus,
  type ElectroMartOrder,
} from "@/src/infrastructure/providers/electromart/types";

function normalizeOrderId(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeLastName(value: string): string {
  return value.trim().toUpperCase();
}

function mapOrder(row: Record<string, unknown>): ElectroMartOrder {
  return {
    id: String(row.id),
    orderId: String(row.order_id),
    lastName: String(row.last_name),
    productName: String(row.product_name),
    purchasedAt: String(row.purchased_at),
    warrantyMonths: Number(row.warranty_months),
    purchasePrice: normalizeSqlMoney(row.purchase_price),
    currency: String(row.currency),
    returnOpened: Boolean(row.return_opened),
  };
}

function mapClaim(row: Record<string, unknown>): ElectroMartClaim {
  return {
    id: String(row.id),
    orderUuid: String(row.order_uuid),
    orderId: String(row.order_id),
    lastName: String(row.last_name),
    amount: normalizeSqlMoney(row.amount),
    currency: String(row.currency),
    status: row.status as ElectroMartClaimStatus,
    idempotencyKey: String(row.idempotency_key),
    aegisCaseId: row.aegis_case_id ? String(row.aegis_case_id) : null,
    createdAt: String(row.created_at),
  };
}

const THEATER_TEMPLATE = {
  orderId: "EM-4412",
  lastName: "MOREAU",
} as const;

export class ElectroMartProvider {
  constructor(private readonly client = createAdminSupabaseClient()) {}

  async getOrder(orderId: string, lastName: string): Promise<ElectroMartOrder> {
    const { data, error } = await this.client
      .from("electromart_orders")
      .select("*")
      .eq("order_id", normalizeOrderId(orderId))
      .eq("last_name", normalizeLastName(lastName))
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      throw new ElectroMartNotFoundError();
    }
    return mapOrder(data);
  }

  async getReturnPolicy() {
    return this.getPublishedPolicy();
  }

  async getWarranty(orderId: string, lastName: string) {
    const order = await this.getOrder(orderId, lastName);
    const endsAt = warrantyEndsAt(order.purchasedAt, order.warrantyMonths);
    const inWarranty = Date.now() <= endsAt.getTime();
    return {
      orderId: order.orderId,
      productName: order.productName,
      purchasedAt: order.purchasedAt,
      warrantyMonths: order.warrantyMonths,
      warrantyEndsAt: endsAt.toISOString(),
      inWarranty,
      returnOpened: order.returnOpened,
    };
  }

  async getPublishedPolicy() {
    const { data, error } = await this.client
      .from("provider_policies")
      .select("*")
      .eq("provider", "electromart")
      .eq("policy_key", "in_warranty_defect")
      .eq("version", "2026.09")
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      throw new Error("ElectroMart policy is not published.");
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

  async getClaimForOrder(orderId: string): Promise<ElectroMartClaim | null> {
    const { data, error } = await this.client
      .from("electromart_claims")
      .select("*")
      .eq("order_id", normalizeOrderId(orderId))
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    return data ? mapClaim(data) : null;
  }

  async calculateWarranty(orderId: string, lastName: string) {
    const order = await this.getOrder(orderId, lastName);
    const existing = await this.getClaimForOrder(order.orderId);
    const decision = evaluateWarrantyClaim({
      orderFound: true,
      purchasedAt: order.purchasedAt,
      warrantyMonths: order.warrantyMonths,
      existingClaim: Boolean(existing),
      returnOpened: order.returnOpened,
      purchasePrice: order.purchasePrice,
      currency: order.currency,
    });

    return {
      orderId: order.orderId,
      outcome: decision.outcome,
      amount: decision.amount,
      currency: decision.currency,
      reasons: decision.reasons,
      ruleIds: decision.ruleIds,
    };
  }

  async createReturn(params: { orderId: string; lastName: string }): Promise<ElectroMartOrder> {
    const order = await this.getOrder(params.orderId, params.lastName);
    if (order.returnOpened) {
      return order;
    }

    const { data, error } = await this.client
      .from("electromart_orders")
      .update({ return_opened: true })
      .eq("id", order.id)
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Return could not be opened.");
    }
    return mapOrder(data);
  }

  async submitWarrantyClaim(params: {
    orderId: string;
    lastName: string;
    amount: string;
    currency: string;
    idempotencyKey: string;
    aegisCaseId?: string;
  }): Promise<ElectroMartClaim> {
    const existingByKey = await this.client
      .from("electromart_claims")
      .select("*")
      .eq("idempotency_key", params.idempotencyKey)
      .maybeSingle();

    if (existingByKey.error) {
      throw new Error(existingByKey.error.message);
    }
    if (existingByKey.data) {
      return mapClaim(existingByKey.data);
    }

    const order = await this.getOrder(params.orderId, params.lastName);
    const compensation = await this.calculateWarranty(params.orderId, params.lastName);

    if (compensation.outcome !== "eligible" || !compensation.amount) {
      throw new ElectroMartConflictError(
        compensation.reasons[0] ?? "Order is not eligible for a warranty claim.",
      );
    }

    if (compensation.amount !== params.amount || compensation.currency !== params.currency) {
      throw new ElectroMartConflictError("Submitted amount does not match the ElectroMart calculation.");
    }

    const { data, error } = await this.client
      .from("electromart_claims")
      .insert({
        order_uuid: order.id,
        order_id: order.orderId,
        last_name: order.lastName,
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
        const replay = await this.getClaimForOrder(order.orderId);
        if (replay) {
          return replay;
        }
        throw new ElectroMartConflictError("A warranty claim already exists for this order.");
      }
      throw new Error(error.message);
    }

    return mapClaim(data);
  }

  async getClaimStatus(claimId: string): Promise<ElectroMartClaim> {
    const { data, error } = await this.client
      .from("electromart_claims")
      .select("*")
      .eq("id", claimId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      throw new ElectroMartNotFoundError();
    }
    return mapClaim(data);
  }

  async issueTheaterOrder(): Promise<ElectroMartOrder> {
    const template = await this.getOrder(THEATER_TEMPLATE.orderId, THEATER_TEMPLATE.lastName);
    const purchasedAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const suffix = randomBytes(3).toString("hex").toUpperCase();
      const orderId = `EM-${suffix}`;
      const { data, error } = await this.client
        .from("electromart_orders")
        .insert({
          order_id: orderId,
          last_name: template.lastName,
          product_name: template.productName,
          purchased_at: purchasedAt,
          warranty_months: template.warrantyMonths,
          purchase_price: template.purchasePrice,
          currency: template.currency,
          return_opened: false,
        })
        .select("*")
        .single();

      if (!error && data) {
        return mapOrder(data);
      }
      if (error?.code === "23505") {
        continue;
      }
      throw new Error(error?.message ?? "ElectroMart could not issue a theater order.");
    }

    throw new Error("ElectroMart could not issue a unique theater order.");
  }
}

export function createElectroMartProvider() {
  return new ElectroMartProvider();
}
