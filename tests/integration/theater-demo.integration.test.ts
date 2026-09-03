import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminSupabaseClient } from "@/src/infrastructure/db/supabase/admin";
import {
  createTheaterSession,
  decideTheaterWorkItem,
  executeTheaterTool,
  getTheaterSnapshot,
} from "@/src/application/commands/theater-session";
import { TheaterPermissionError } from "@/src/domain/theater/permission";
import { TheaterSessionError } from "@/src/domain/theater/errors";

const hasSupabase =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

describe("theater integration gate", () => {
  it("does not pretend live tests ran when they were skipped", () => {
    if (!hasSupabase && process.env.AEGIS_REQUIRE_THEATER_INTEGRATION === "1") {
      throw new Error(
        "Theater integration tests require NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      );
    }
    if (!hasSupabase) {
      console.warn("LIVE THEATER INTEGRATION SKIPPED: missing Supabase env");
    }
    expect(true).toBe(true);
  });
});

const describeIf = hasSupabase ? describe : describe.skip;

describeIf("resolution theater (integration)", () => {
  const cleanup = {
    sessionIds: [] as string[],
    flyrightLocators: [] as string[],
    streamlySubscriptionIds: [] as string[],
  };

  let token: string | null = null;
  let schemaOk = false;

  beforeAll(async () => {
    const client = createAdminSupabaseClient();
    const probe = await client.from("theater_sessions").select("id").limit(1);
    const audit = await client.from("theater_audit_events").select("id").limit(1);
    schemaOk = !probe.error && !audit.error;
    if (!schemaOk) {
      throw new Error(
        probe.error?.message ??
          audit.error?.message ??
          "Theater schema is missing. Apply supabase/migrations including theater_hardening.",
      );
    }
  });

  afterAll(async () => {
    if (!schemaOk) return;
    const client = createAdminSupabaseClient();
    if (cleanup.sessionIds.length > 0) {
      await client.from("theater_sessions").delete().in("id", cleanup.sessionIds);
    }
    for (const locator of cleanup.flyrightLocators) {
      await client.from("flyright_claims").delete().eq("locator", locator);
      await client.from("flyright_bookings").delete().eq("locator", locator);
    }
    for (const subscriptionId of cleanup.streamlySubscriptionIds) {
      await client.from("streamly_refunds").delete().eq("subscription_id", subscriptionId);
      await client.from("streamly_subscriptions").delete().eq("subscription_id", subscriptionId);
    }
  });

  async function prepare(workItemId: string) {
    if (!token) throw new Error("missing token");
    await executeTheaterTool({ token, tool: "inspect_counter", input: { workItemId } });
    await executeTheaterTool({ token, tool: "compute_entitlement", input: { workItemId } });
    await executeTheaterTool({ token, tool: "prepare_filing", input: { workItemId } });
    await executeTheaterTool({ token, tool: "request_signature", input: { workItemId } });
  }

  it("approval_required → approve → execute → verify, and replay is idempotent", async () => {
    const created = await createTheaterSession();
    token = created.token;
    cleanup.sessionIds.push(created.snapshot.sessionId);
    const flyItem = created.snapshot.items[0];
    const streamItem = created.snapshot.items[1];
    const blockedItem = created.snapshot.items[2];
    if (!flyItem || !streamItem || !blockedItem) {
      throw new Error("Theater session did not issue three work items.");
    }

    expect(flyItem.providerId).toBe("flyright");
    expect(streamItem.providerId).toBe("streamly");
    expect(blockedItem.catalogBlocked).toBe(true);
    if (flyItem.identity.providerId === "flyright") {
      cleanup.flyrightLocators.push(flyItem.identity.locator);
    }
    if (streamItem.identity.providerId === "streamly") {
      cleanup.streamlySubscriptionIds.push(streamItem.identity.subscriptionId);
    }

    await prepare(flyItem.id);

    await expect(
      executeTheaterTool({ token, tool: "execute_filing", input: { workItemId: flyItem.id } }),
    ).rejects.toBeInstanceOf(TheaterPermissionError);

    await expect(
      executeTheaterTool({ token, tool: "execute_filing", input: { workItemId: flyItem.id } }),
    ).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });

    await decideTheaterWorkItem({ token, workItemId: flyItem.id, decision: "approved" });

    const preparedAgain = await executeTheaterTool({
      token,
      tool: "prepare_filing",
      input: { workItemId: flyItem.id },
    });
    expect(preparedAgain.result.replay).toBe(true);
    const stillSigned = await getTheaterSnapshot(token);
    expect(stillSigned.items.find((item) => item.id === flyItem.id)?.status).toBe("APPROVED");

    const client = createAdminSupabaseClient();
    const before = await client
      .from("flyright_claims")
      .select("id", { count: "exact", head: true })
      .eq("locator", cleanup.flyrightLocators[0]);

    const executed = await executeTheaterTool({ token, tool: "execute_filing", input: { workItemId: flyItem.id } });
    expect(executed.result.mutation).toBeDefined();

    const verified = await executeTheaterTool({ token, tool: "verify_filing", input: { workItemId: flyItem.id } });
    expect((verified.result.verification as { matched: boolean }).matched).toBe(true);

    const replayExec = await executeTheaterTool({ token, tool: "execute_filing", input: { workItemId: flyItem.id } });
    expect(replayExec.result.replay).toBe(true);

    const after = await client
      .from("flyright_claims")
      .select("id", { count: "exact", head: true })
      .eq("locator", cleanup.flyrightLocators[0]);
    expect(after.count).toBe((before.count ?? 0) + 1);

    const snapshot = await getTheaterSnapshot(token);
    expect(snapshot.items.find((item) => item.id === flyItem.id)?.status).toBe("VERIFIED");
  });

  it("verification mismatch fails closed and concurrent execute shares one mutation", async () => {
    if (!token) throw new Error("missing token");
    const snapshot = await getTheaterSnapshot(token);
    const item = snapshot.items.find((it) => it.providerId === "streamly");
    expect(item).toBeTruthy();
    if (!item) return;

    await prepare(item.id);
    await decideTheaterWorkItem({ token, workItemId: item.id, decision: "approved" });

    const [first, second] = await Promise.all([
      executeTheaterTool({ token, tool: "execute_filing", input: { workItemId: item.id } }),
      executeTheaterTool({ token, tool: "execute_filing", input: { workItemId: item.id } }),
    ]);
    const firstId = (first.result.mutation as { id: string }).id;
    const secondId = (second.result.mutation as { id: string }).id;
    expect(firstId).toBe(secondId);

    const client = createAdminSupabaseClient();
    await client.from("streamly_refunds").update({ amount: "0.01" }).eq("id", firstId);

    const verified = await executeTheaterTool({ token, tool: "verify_filing", input: { workItemId: item.id } });
    expect((verified.result.verification as { matched: boolean }).matched).toBe(false);

    const after = await getTheaterSnapshot(token);
    expect(after.items.find((it) => it.id === item.id)?.status).toBe("FAILED");

    const retried = await executeTheaterTool({ token, tool: "verify_filing", input: { workItemId: item.id } });
    expect((retried.result.verification as { matched: boolean }).matched).toBe(false);
  });

  it("provider conflict is surfaced (already claimed FlyRight probe)", async () => {
    if (!token) throw new Error("missing token");
    const snapshot = await getTheaterSnapshot(token);
    cleanup.sessionIds.push(snapshot.sessionId);

    const client = createAdminSupabaseClient();
    const { data: claim, error } = await client
      .from("flyright_claims")
      .select("*")
      .eq("locator", "FR0999")
      .limit(1);
    if (error) {
      throw new Error(error.message);
    }
    expect(claim?.length ?? 0).toBeGreaterThan(0);

    const blocked = snapshot.items.find((it) => it.catalogBlocked);
    expect(blocked).toBeTruthy();
    if (!blocked) return;

    const computed = await executeTheaterTool({
      token,
      tool: "compute_entitlement",
      input: { workItemId: blocked.id },
    });
    const entitlement = computed.result.entitlement as { outcome: string; reasons?: string[] };
    expect(entitlement.outcome).toBe("ineligible");

    await expect(
      executeTheaterTool({ token, tool: "prepare_filing", input: { workItemId: blocked.id } }),
    ).rejects.toMatchObject({ code: "NOT_ELIGIBLE" });
  });

  it("denies a filing and rejects malformed ids", async () => {
    if (!token) throw new Error("missing token");
    await expect(
      executeTheaterTool({ token, tool: "inspect_counter", input: { workItemId: "nope" } }),
    ).rejects.toBeInstanceOf(TheaterSessionError);

    const created = await createTheaterSession();
    token = created.token;
    cleanup.sessionIds.push(created.snapshot.sessionId);
    const flyItem = created.snapshot.items[0];
    if (!flyItem || flyItem.identity.providerId !== "flyright") {
      throw new Error("missing flyright item");
    }
    cleanup.flyrightLocators.push(flyItem.identity.locator);
    const streamItem = created.snapshot.items[1];
    if (streamItem?.identity.providerId === "streamly") {
      cleanup.streamlySubscriptionIds.push(streamItem.identity.subscriptionId);
    }

    await prepare(flyItem.id);
    await decideTheaterWorkItem({ token, workItemId: flyItem.id, decision: "denied" });
    await expect(
      executeTheaterTool({ token, tool: "execute_filing", input: { workItemId: flyItem.id } }),
    ).rejects.toMatchObject({ code: "DENIED" });
  });
});
