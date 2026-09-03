import { describe, expect, it } from "vitest";
import { connectSandboxMail } from "@/src/application/commands/connect-mail";
import { CaseService } from "@/src/domain/cases/case-service";
import { evaluateFlightRefund } from "@/src/domain/eligibility/evaluate-flight-refund";
import { evaluateUnroutedMessage } from "@/src/domain/eligibility/evaluate-unrouted";
import { caseDraftFromMail, type MailCatalogMessage } from "@/src/domain/mail/case-draft-from-mail";
import { InMemoryCaseRepository } from "@/src/infrastructure/db/cases/in-memory-case-repository";

const newsletter: MailCatalogMessage = {
  messageKey: "mail-newsletter",
  fromAddress: "deals@promo.example",
  fromName: "Deals",
  subject: "20% off everything this weekend",
  sentAt: "2026-09-01T08:00:00.000Z",
  body: "Use code WEEKEND20. This is marketing mail, not a claim.",
  hint: "Looks like marketing. Opening a file should not invent money.",
  routeProvider: null,
  routeCaseType: null,
  locatorHint: null,
  lastNameHint: null,
  accountEmailHint: null,
};

const onTime: MailCatalogMessage = {
  messageKey: "mail-fr2201-ontime",
  fromAddress: "noreply@flyright.example",
  fromName: "FlyRight",
  subject: "FR2201 is on time",
  sentAt: "2026-09-11T18:00:00.000Z",
  body: "Jonas Klein, flight FR2201 is scheduled and on time.",
  hint: "Looks like a status update, not a cancellation.",
  routeProvider: "flyright",
  routeCaseType: "flight_compensation",
  locatorHint: "FR2201",
  lastNameHint: "KLEIN",
  accountEmailHint: null,
};

const billedAfterCancel: MailCatalogMessage = {
  messageKey: "mail-streamly-charge",
  fromAddress: "billing@streamly.example",
  fromName: "Streamly Billing",
  subject: "You were charged after you cancelled",
  sentAt: "2026-08-28T11:04:00.000Z",
  body: "Subscription SL-1001 was charged after cancel.",
  hint: "Might be a billed-after-cancel charge — open a file to check.",
  routeProvider: "streamly",
  routeCaseType: "subscription_refund",
  locatorHint: "SL-1001",
  lastNameHint: null,
  accountEmailHint: "camille.moreau@example.com",
};

describe("sandbox mail intake", () => {
  it("connectSandboxMail writes only a source connection and creates zero cases", async () => {
    const tables: string[] = [];
    const client = {
      from(table: string) {
        tables.push(table);
        return {
          insert: async () => ({ error: null }),
        };
      },
    };

    const result = await connectSandboxMail(client as never, "user_1");
    expect(tables).toEqual(["source_connections"]);
    expect(result.casesCreated).toBe(0);
  });

  it("opening a thread creates a blank file, not a pre-won amount", async () => {
    const repository = new InMemoryCaseRepository();
    const service = new CaseService(repository);
    const created = await service.createCase(caseDraftFromMail("user_1", billedAfterCancel));

    expect(created.status).toBe("DRAFT");
    expect(created.amountAtRisk).toBeNull();
    expect(created.provider).toBe("streamly");
    expect(created.bookingLocator).toBe("SL-1001");
    expect(created.accountEmail).toBe("camille.moreau@example.com");
  });

  it("newsletter threads stay unrouted and do not pay out", async () => {
    const draft = caseDraftFromMail("user_1", newsletter);
    expect(draft.provider).toBe("unspecified");
    expect(draft.bookingLocator).toBeUndefined();

    const repository = new InMemoryCaseRepository();
    const created = await new CaseService(repository).createCase(draft);
    expect(created.amountAtRisk).toBeNull();

    const decision = evaluateUnroutedMessage("EUR");
    expect(decision.outcome).toBe("uncertain");
    expect(decision.amount).toBeNull();
  });

  it("on-time FlyRight mail stays ineligible when investigated against carrier state", () => {
    const draft = caseDraftFromMail("user_1", onTime);
    expect(draft.provider).toBe("flyright");
    expect(draft.bookingLocator).toBe("FR2201");

    const decision = evaluateFlightRefund({
      bookingFound: true,
      cancelledByCarrier: false,
      ticketUnused: true,
      flightStatus: "SCHEDULED",
      farePaid: "94.00",
      currency: "EUR",
      existingClaim: false,
    });
    expect(decision.outcome).toBe("ineligible");
    expect(decision.amount).toBeNull();
  });
});
