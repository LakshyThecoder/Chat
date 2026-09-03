import { describe, expect, it } from "vitest";
import { buildSupportDraft, evaluateBilledAfterCancel } from "@/src/domain/mail-desk/entitlement";
import type { MailDeskBill, MailDeskPolicy } from "@/src/domain/mail-desk/types";
import { MAIL_DESK_TOOLS } from "@/src/domain/mail-desk/tools";

const bill: MailDeskBill = {
  messageKey: "mail-codeforge-pro",
  filename: "CF-20418-bill.txt",
  merchant: "CodeForge",
  invoiceId: "CF-20418",
  amount: "20.00",
  currency: "EUR",
  billedAt: "2026-08-28T08:00:00.000Z",
  cancelledAt: "2026-08-12T16:40:00.000Z",
  planName: "CodeForge Pro",
  supportAddress: "support@codeforge.example",
  bodyText: "invoice",
};

const policy: MailDeskPolicy = {
  provider: "codeforge",
  policyKey: "billed_after_cancel",
  version: "2026.09",
  title: "CodeForge refund",
  body: "billed after cancel gets full refund",
  source: "provider_policies:codeforge",
};

describe("mail desk entitlement", () => {
  it("refunds billed-after-cancel from the invoice amount", () => {
    const result = evaluateBilledAfterCancel({ bill, policy });
    expect(result.eligible).toBe(true);
    expect(result.amount).toBe("20.00");
  });

  it("rejects charges on or before cancel", () => {
    const result = evaluateBilledAfterCancel({
      bill: { ...bill, billedAt: "2026-08-10T08:00:00.000Z" },
      policy,
    });
    expect(result.eligible).toBe(false);
  });

  it("builds a support draft to the merchant support address", () => {
    const eligibility = evaluateBilledAfterCancel({ bill, policy });
    const draft = buildSupportDraft({ bill, policy, eligibility });
    expect(draft.toAddress).toBe("support@codeforge.example");
    expect(draft.amount).toBe("20.00");
    expect(draft.body).toMatch(/CF-20418/);
  });

  it("registers send as human-gated in contract copy", () => {
    const send = MAIL_DESK_TOOLS.find((tool) => tool.name === "send_support_email");
    expect(send?.description).toMatch(/APPROVAL_REQUIRED/);
    expect(MAIL_DESK_TOOLS.map((tool) => tool.name)).toContain("begin_mail_resolution");
  });
});
