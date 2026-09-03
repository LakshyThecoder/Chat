import type { CaseStatus } from "@/src/domain/cases/state-machine";

export interface CaseRecord {
  id: string;
  userId: string;
  provider: string;
  caseType: string;
  title: string;
  summary: string | null;
  status: CaseStatus;
  amountAtRisk: string | null;
  currency: string;
  confidence: string | null;
  nextAction: string | null;
  bookingLocator: string | null;
  passengerLastName: string | null;
  accountEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CaseEventRecord {
  id: string;
  caseId: string;
  userId: string;
  eventType: string;
  fromStatus: CaseStatus | null;
  toStatus: CaseStatus | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface CreateCaseInput {
  userId: string;
  provider: string;
  caseType: string;
  title: string;
  summary?: string;
  currency?: string;
  bookingLocator?: string;
  passengerLastName?: string;
  accountEmail?: string;
}

export interface CaseRepository {
  create(input: CreateCaseInput): Promise<CaseRecord>;
  findByIdForUser(caseId: string, userId: string): Promise<CaseRecord | null>;
  listForUser(userId: string): Promise<CaseRecord[]>;
  updateStatus(params: {
    caseId: string;
    userId: string;
    fromStatus: CaseStatus;
    toStatus: CaseStatus;
    nextAction?: string | null;
  }): Promise<CaseRecord>;
  updateEngineFields(params: {
    caseId: string;
    userId: string;
    amountAtRisk?: string | null;
    nextAction?: string | null;
    bookingLocator?: string | null;
    passengerLastName?: string | null;
    accountEmail?: string | null;
  }): Promise<CaseRecord>;
  appendEvent(event: {
    caseId: string;
    userId: string;
    eventType: string;
    fromStatus?: CaseStatus | null;
    toStatus?: CaseStatus | null;
    payload?: Record<string, unknown>;
  }): Promise<CaseEventRecord>;
  listEvents(caseId: string, userId: string): Promise<CaseEventRecord[]>;
}
