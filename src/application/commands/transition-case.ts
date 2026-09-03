import { z } from "zod";
import { CaseService } from "@/src/domain/cases/case-service";
import { CASE_STATUSES } from "@/src/domain/cases/state-machine";
import type { CaseRepository } from "@/src/domain/cases/types";

export const transitionCaseCommandSchema = z.object({
  toStatus: z.enum(CASE_STATUSES),
  autonomousExecutionAllowed: z.boolean().optional(),
  nextAction: z.string().max(500).nullable().optional(),
  reason: z.string().max(1000).optional(),
});

export type TransitionCaseCommand = z.infer<typeof transitionCaseCommandSchema>;

export async function transitionCase(
  repository: CaseRepository,
  userId: string,
  caseId: string,
  command: TransitionCaseCommand,
) {
  const service = new CaseService(repository);
  return service.transitionCase({
    caseId,
    userId,
    toStatus: command.toStatus,
    autonomousExecutionAllowed: command.autonomousExecutionAllowed,
    nextAction: command.nextAction,
    reason: command.reason,
  });
}
