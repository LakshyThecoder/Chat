import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminSupabaseClient } from "@/src/infrastructure/db/supabase/admin";
import {
  createMailDeskSession,
  decideMailDeskItem,
  executeMailDeskTool,
  getMailDeskSnapshot,
} from "@/src/application/commands/mail-desk-session";
import { MailDeskError, MailDeskPermissionError } from "@/src/domain/mail-desk/errors";

const hasSupabase =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

describe("mail desk integration gate", () => {
  it("does not pretend live tests ran when they were skipped", () => {
    if (!hasSupabase && process.env.AEGIS_REQUIRE_THEATER_INTEGRATION === "1") {
      throw new Error("Mail desk integration requires Supabase env.");
    }
    if (!hasSupabase) {
      console.warn("LIVE MAIL DESK INTEGRATION SKIPPED: missing Supabase env");
    }
    expect(true).toBe(true);
  });
});

const describeIf = hasSupabase ? describe : describe.skip;

describeIf("mail desk (integration)", () => {
  const cleanup = { sessionIds: [] as string[] };
  let schemaOk = false;

  beforeAll(async () => {
    const client = createAdminSupabaseClient();
    const sessions = await client.from("mail_desk_sessions").select("id").limit(1);
    const bills = await client.from("mail_bill_catalog").select("message_key").eq("message_key", "mail-codeforge-pro");
    schemaOk = !sessions.error && !bills.error && (bills.data?.length ?? 0) > 0;
    if (!schemaOk) {
      throw new Error(
        sessions.error?.message ??
          bills.error?.message ??
          "Mail desk schema/seed missing. Apply 20260903000900_mail_desk.sql",
      );
    }
  });

  afterAll(async () => {
    if (!schemaOk || cleanup.sessionIds.length === 0) return;
    const client = createAdminSupabaseClient();
    await client.from("mail_desk_sessions").delete().in("id", cleanup.sessionIds);
  });

  it(
    "begin → unsigned send denied → sign → send → verify → replay",
    async () => {
      const created = await createMailDeskSession();
      cleanup.sessionIds.push(created.snapshot.sessionId);
      const token = created.token;

      expect(created.snapshot.items.length).toBeGreaterThanOrEqual(1);
      const codeforge = created.snapshot.items.find((item) => item.messageKey === "mail-codeforge-pro");
      expect(codeforge).toBeTruthy();
      if (!codeforge) return;

      const begun = await executeMailDeskTool({ token, tool: "begin_mail_resolution", input: {} });
      expect((begun.result as { prepared?: string[] }).prepared?.length).toBeGreaterThan(0);

      const afterBegin = await getMailDeskSnapshot(token);
      const awaiting = afterBegin.items.find((item) => item.id === codeforge.id);
      expect(awaiting?.status).toBe("AWAITING_SIGNATURE");
      expect(awaiting?.bill?.amount).toBe("20.00");
      expect(awaiting?.draft?.toAddress).toBe("support@codeforge.example");

      await expect(
        executeMailDeskTool({ token, tool: "send_support_email", input: { itemId: codeforge.id } }),
      ).rejects.toBeInstanceOf(MailDeskPermissionError);

      await expect(
        executeMailDeskTool({ token, tool: "send_support_email", input: { itemId: codeforge.id } }),
      ).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });

      await decideMailDeskItem({ token, itemId: codeforge.id, decision: "approved" });
      const signed = await getMailDeskSnapshot(token);
      expect(signed.items.find((item) => item.id === codeforge.id)?.status).toBe("APPROVED");

      const sent = await executeMailDeskTool({
        token,
        tool: "send_support_email",
        input: { itemId: codeforge.id },
      });
      expect((sent.result as { mutation?: { id: string } }).mutation?.id).toBeTruthy();

      const verified = await executeMailDeskTool({
        token,
        tool: "verify_sent",
        input: { itemId: codeforge.id },
      });
      expect((verified.result as { verification?: { matched: boolean } }).verification?.matched).toBe(true);

      const replay = await executeMailDeskTool({
        token,
        tool: "send_support_email",
        input: { itemId: codeforge.id },
      });
      expect((replay.result as { replay?: boolean }).replay).toBe(true);

      const finalSnap = await getMailDeskSnapshot(token);
      expect(finalSnap.items.find((item) => item.id === codeforge.id)?.status).toBe("VERIFIED");
    },
    30_000,
  );

  it("rejects malformed item ids", async () => {
    const created = await createMailDeskSession();
    cleanup.sessionIds.push(created.snapshot.sessionId);
    await expect(
      executeMailDeskTool({ token: created.token, tool: "import_bill", input: { itemId: "nope" } }),
    ).rejects.toThrow(/UUID|itemId/i);
  });
});
