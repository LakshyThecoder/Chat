import type { CaseStatus } from "@/src/domain/cases/state-machine";
import type {
  CaseEventRecord,
  CaseRecord,
  CaseRepository,
  CreateCaseInput,
} from "@/src/domain/cases/types";

function nowIso(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export class InMemoryCaseRepository implements CaseRepository {
  private readonly cases = new Map<string, CaseRecord>();
  private readonly events: CaseEventRecord[] = [];

  async create(input: CreateCaseInput): Promise<CaseRecord> {
    const timestamp = nowIso();
    const record: CaseRecord = {
      id: createId("case"),
      userId: input.userId,
      provider: input.provider,
      caseType: input.caseType,
      title: input.title,
      summary: input.summary ?? null,
      status: "DRAFT",
      amountAtRisk: null,
      currency: input.currency ?? "EUR",
      confidence: null,
      nextAction: "Look up the counter record or upload evidence",
      bookingLocator: input.bookingLocator?.toUpperCase() ?? null,
      passengerLastName: input.passengerLastName?.toUpperCase() ?? null,
      accountEmail: input.accountEmail?.trim().toLowerCase() ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.cases.set(record.id, record);
    return record;
  }

  async findByIdForUser(caseId: string, userId: string): Promise<CaseRecord | null> {
    const found = this.cases.get(caseId);
    if (!found || found.userId !== userId) {
      return null;
    }
    return found;
  }

  async listForUser(userId: string): Promise<CaseRecord[]> {
    return [...this.cases.values()]
      .filter((item) => item.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async updateStatus(params: {
    caseId: string;
    userId: string;
    fromStatus: CaseStatus;
    toStatus: CaseStatus;
    nextAction?: string | null;
  }): Promise<CaseRecord> {
    const current = await this.findByIdForUser(params.caseId, params.userId);
    if (!current) {
      throw new Error(`Case not found: ${params.caseId}`);
    }
    if (current.status !== params.fromStatus) {
      throw new Error(`Case status conflict: expected ${params.fromStatus}, got ${current.status}`);
    }

    const updated: CaseRecord = {
      ...current,
      status: params.toStatus,
      nextAction: params.nextAction === undefined ? current.nextAction : params.nextAction,
      updatedAt: nowIso(),
    };
    this.cases.set(updated.id, updated);
    return updated;
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
    const current = await this.findByIdForUser(params.caseId, params.userId);
    if (!current) {
      throw new Error(`Case not found: ${params.caseId}`);
    }

    const updated: CaseRecord = {
      ...current,
      amountAtRisk:
        params.amountAtRisk === undefined ? current.amountAtRisk : params.amountAtRisk,
      nextAction: params.nextAction === undefined ? current.nextAction : params.nextAction,
      bookingLocator:
        params.bookingLocator === undefined ? current.bookingLocator : params.bookingLocator,
      passengerLastName:
        params.passengerLastName === undefined
          ? current.passengerLastName
          : params.passengerLastName,
      accountEmail:
        params.accountEmail === undefined ? current.accountEmail : params.accountEmail,
      updatedAt: nowIso(),
    };
    this.cases.set(updated.id, updated);
    return updated;
  }

  async appendEvent(event: {
    caseId: string;
    userId: string;
    eventType: string;
    fromStatus?: CaseStatus | null;
    toStatus?: CaseStatus | null;
    payload?: Record<string, unknown>;
  }): Promise<CaseEventRecord> {
    const record: CaseEventRecord = {
      id: createId("evt"),
      caseId: event.caseId,
      userId: event.userId,
      eventType: event.eventType,
      fromStatus: event.fromStatus ?? null,
      toStatus: event.toStatus ?? null,
      payload: event.payload ?? {},
      createdAt: nowIso(),
    };
    this.events.push(record);
    return record;
  }

  async listEvents(caseId: string, userId: string): Promise<CaseEventRecord[]> {
    return this.events.filter((event) => event.caseId === caseId && event.userId === userId);
  }
}
