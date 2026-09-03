import {
  assertCaseTransition,
  type CaseStatus,
} from "@/src/domain/cases/state-machine";
import type { CaseRecord, CaseRepository, CreateCaseInput } from "@/src/domain/cases/types";

export class CaseNotFoundError extends Error {
  readonly code = "CASE_NOT_FOUND";

  constructor(caseId: string) {
    super(`Case not found: ${caseId}`);
    this.name = "CaseNotFoundError";
  }
}

export class CaseService {
  constructor(private readonly cases: CaseRepository) {}

  async createCase(input: CreateCaseInput): Promise<CaseRecord> {
    const created = await this.cases.create({
      ...input,
      currency: input.currency ?? "EUR",
    });

    await this.cases.appendEvent({
      caseId: created.id,
      userId: created.userId,
      eventType: "CASE_CREATED",
      fromStatus: null,
      toStatus: created.status,
      payload: {
        provider: created.provider,
        caseType: created.caseType,
      },
    });

    return created;
  }

  async getCase(caseId: string, userId: string): Promise<CaseRecord> {
    const found = await this.cases.findByIdForUser(caseId, userId);
    if (!found) {
      throw new CaseNotFoundError(caseId);
    }
    return found;
  }

  async listCases(userId: string): Promise<CaseRecord[]> {
    return this.cases.listForUser(userId);
  }

  async transitionCase(params: {
    caseId: string;
    userId: string;
    toStatus: CaseStatus;
    autonomousExecutionAllowed?: boolean;
    nextAction?: string | null;
    reason?: string;
  }): Promise<CaseRecord> {
    const current = await this.getCase(params.caseId, params.userId);

    assertCaseTransition(current.status, params.toStatus, {
      autonomousExecutionAllowed: params.autonomousExecutionAllowed,
    });

    const updated = await this.cases.updateStatus({
      caseId: params.caseId,
      userId: params.userId,
      fromStatus: current.status,
      toStatus: params.toStatus,
      nextAction: params.nextAction,
    });

    await this.cases.appendEvent({
      caseId: updated.id,
      userId: params.userId,
      eventType: "CASE_STATUS_CHANGED",
      fromStatus: current.status,
      toStatus: params.toStatus,
      payload: {
        reason: params.reason ?? null,
        autonomousExecutionAllowed: params.autonomousExecutionAllowed ?? false,
      },
    });

    return updated;
  }
}
