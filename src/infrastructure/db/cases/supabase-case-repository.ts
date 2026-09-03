import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CaseStatus } from "@/src/domain/cases/state-machine";
import type {
  CaseEventRecord,
  CaseRecord,
  CaseRepository,
  CreateCaseInput,
} from "@/src/domain/cases/types";

interface CaseRow {
  id: string;
  user_id: string;
  provider: string;
  case_type: string;
  title: string;
  summary: string | null;
  status: CaseStatus;
  amount_at_risk: string | null;
  currency: string;
  confidence: string | null;
  next_action: string | null;
  booking_locator: string | null;
  passenger_last_name: string | null;
  account_email: string | null;
  created_at: string;
  updated_at: string;
}

interface CaseEventRow {
  id: string;
  case_id: string;
  user_id: string;
  event_type: string;
  from_status: CaseStatus | null;
  to_status: CaseStatus | null;
  payload: Record<string, unknown>;
  created_at: string;
}

function mapCase(row: CaseRow): CaseRecord {
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
    caseType: row.case_type,
    title: row.title,
    summary: row.summary,
    status: row.status,
    amountAtRisk: row.amount_at_risk,
    currency: row.currency,
    confidence: row.confidence,
    nextAction: row.next_action,
    bookingLocator: row.booking_locator,
    passengerLastName: row.passenger_last_name,
    accountEmail: row.account_email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEvent(row: CaseEventRow): CaseEventRecord {
  return {
    id: row.id,
    caseId: row.case_id,
    userId: row.user_id,
    eventType: row.event_type,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    payload: row.payload ?? {},
    createdAt: row.created_at,
  };
}

export class SupabaseCaseRepository implements CaseRepository {
  constructor(private readonly client: SupabaseClient) {}

  async create(input: CreateCaseInput): Promise<CaseRecord> {
    const { data, error } = await this.client
      .from("cases")
      .insert({
        user_id: input.userId,
        provider: input.provider,
        case_type: input.caseType,
        title: input.title,
        summary: input.summary ?? null,
        currency: input.currency ?? "EUR",
        status: "DRAFT",
        booking_locator: input.bookingLocator?.toUpperCase() ?? null,
        passenger_last_name: input.passengerLastName?.toUpperCase() ?? null,
        account_email: input.accountEmail?.trim().toLowerCase() ?? null,
        next_action: "Look up the counter record or upload evidence",
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Failed to create case");
    }

    return mapCase(data as CaseRow);
  }

  async findByIdForUser(caseId: string, userId: string): Promise<CaseRecord | null> {
    const { data, error } = await this.client
      .from("cases")
      .select("*")
      .eq("id", caseId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return data ? mapCase(data as CaseRow) : null;
  }

  async listForUser(userId: string): Promise<CaseRecord[]> {
    const { data, error } = await this.client
      .from("cases")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data as CaseRow[] | null)?.map(mapCase) ?? [];
  }

  async updateStatus(params: {
    caseId: string;
    userId: string;
    fromStatus: CaseStatus;
    toStatus: CaseStatus;
    nextAction?: string | null;
  }): Promise<CaseRecord> {
    const patch: Record<string, unknown> = {
      status: params.toStatus,
      updated_at: new Date().toISOString(),
    };

    if (params.nextAction !== undefined) {
      patch.next_action = params.nextAction;
    }

    const { data, error } = await this.client
      .from("cases")
      .update(patch)
      .eq("id", params.caseId)
      .eq("user_id", params.userId)
      .eq("status", params.fromStatus)
      .select("*")
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error("Case status update conflict or case not found");
    }

    return mapCase(data as CaseRow);
  }

  async updateEngineFields(params: {
    caseId: string;
    userId: string;
    amountAtRisk?: string | null;
    nextAction?: string | null;
    bookingLocator?: string | null;
    passengerLastName?: string | null;
    accountEmail?: string | null;
  }): Promise<CaseRecord> {
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (params.amountAtRisk !== undefined) {
      patch.amount_at_risk = params.amountAtRisk;
    }
    if (params.nextAction !== undefined) {
      patch.next_action = params.nextAction;
    }
    if (params.bookingLocator !== undefined) {
      patch.booking_locator = params.bookingLocator;
    }
    if (params.passengerLastName !== undefined) {
      patch.passenger_last_name = params.passengerLastName;
    }
    if (params.accountEmail !== undefined) {
      patch.account_email = params.accountEmail;
    }

    const { data, error } = await this.client
      .from("cases")
      .update(patch)
      .eq("id", params.caseId)
      .eq("user_id", params.userId)
      .select("*")
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error("Case engine update failed or case not found");
    }

    return mapCase(data as CaseRow);
  }

  async appendEvent(event: {
    caseId: string;
    userId: string;
    eventType: string;
    fromStatus?: CaseStatus | null;
    toStatus?: CaseStatus | null;
    payload?: Record<string, unknown>;
  }): Promise<CaseEventRecord> {
    const { data, error } = await this.client
      .from("case_events")
      .insert({
        case_id: event.caseId,
        user_id: event.userId,
        event_type: event.eventType,
        from_status: event.fromStatus ?? null,
        to_status: event.toStatus ?? null,
        payload: event.payload ?? {},
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Failed to append case event");
    }

    return mapEvent(data as CaseEventRow);
  }

  async listEvents(caseId: string, userId: string): Promise<CaseEventRecord[]> {
    const { data, error } = await this.client
      .from("case_events")
      .select("*")
      .eq("case_id", caseId)
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return (data as CaseEventRow[] | null)?.map(mapEvent) ?? [];
  }
}
