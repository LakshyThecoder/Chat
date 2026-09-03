import { describe, expect, it } from "vitest";
import { CaseNotFoundError, CaseService } from "@/src/domain/cases/case-service";
import { IllegalCaseTransitionError } from "@/src/domain/cases/state-machine";
import { InMemoryCaseRepository } from "@/src/infrastructure/db/cases/in-memory-case-repository";

describe("CaseService", () => {
  it("creates a case in DRAFT and appends an audit event", async () => {
    const repository = new InMemoryCaseRepository();
    const service = new CaseService(repository);

    const created = await service.createCase({
      userId: "user_1",
      provider: "flyright",
      caseType: "flight_compensation",
      title: "Cancelled FR1842",
      bookingLocator: "FR1842",
      passengerLastName: "Moreau",
    });

    expect(created.status).toBe("DRAFT");
    expect(created.amountAtRisk).toBeNull();
    expect(created.bookingLocator).toBe("FR1842");

    const events = await repository.listEvents(created.id, "user_1");
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe("CASE_CREATED");
  });

  it("transitions with audit and rejects illegal moves", async () => {
    const repository = new InMemoryCaseRepository();
    const service = new CaseService(repository);
    const created = await service.createCase({
      userId: "user_1",
      provider: "flyright",
      caseType: "flight_compensation",
      title: "Cancelled FR1842",
    });

    const investigating = await service.transitionCase({
      caseId: created.id,
      userId: "user_1",
      toStatus: "INVESTIGATING",
      reason: "Evidence uploaded",
    });
    expect(investigating.status).toBe("INVESTIGATING");

    await expect(
      service.transitionCase({
        caseId: created.id,
        userId: "user_1",
        toStatus: "RESOLVED",
      }),
    ).rejects.toBeInstanceOf(IllegalCaseTransitionError);

    const events = await repository.listEvents(created.id, "user_1");
    expect(events.some((event) => event.eventType === "CASE_STATUS_CHANGED")).toBe(true);
  });

  it("does not allow cross-user access", async () => {
    const repository = new InMemoryCaseRepository();
    const service = new CaseService(repository);
    const created = await service.createCase({
      userId: "user_1",
      provider: "flyright",
      caseType: "flight_compensation",
      title: "Cancelled FR1842",
    });

    await expect(service.getCase(created.id, "user_2")).rejects.toBeInstanceOf(
      CaseNotFoundError,
    );
  });
});
