import { CaseService } from "@/src/domain/cases/case-service";
import type { CaseRepository } from "@/src/domain/cases/types";

export async function getCase(repository: CaseRepository, userId: string, caseId: string) {
  const service = new CaseService(repository);
  return service.getCase(caseId, userId);
}

export async function listCases(repository: CaseRepository, userId: string) {
  const service = new CaseService(repository);
  return service.listCases(userId);
}

export async function listCaseEvents(
  repository: CaseRepository,
  userId: string,
  caseId: string,
) {
  // Ownership check via getCase before listing events.
  const service = new CaseService(repository);
  await service.getCase(caseId, userId);
  return repository.listEvents(caseId, userId);
}
