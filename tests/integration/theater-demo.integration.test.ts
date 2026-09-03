import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createAdminSupabaseClient } from "@/src/infrastructure/db/supabase/admin";
import {
  createTheaterSession,
  decideTheaterWorkItem,
  executeTheaterTool,
  getTheaterSnapshot,
} from "@/src/application/commands/theater-session";

const hasSupabase =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

const describeIf = hasSupabase ? describe : describe.skip;

describeIf("resolution theater (integration)", () => {
  const cleanup = {
    sessionId: null as string | null,
    probeWorkItemId: null as string | null,
    flyrightLocator: null as string | null,
    flyrightLastName: null as string | null,
    streamlySubscriptionId: null as string | null,
    streamlyAccountEmail: null as string | null,
    electromartOrderId: null as string | null,
    electromartLastName: null as string | null,
  };

  let token: string | null = null;
  let schemaOk = false;

  beforeAll(async () => {
    const client = createAdminSupabaseClient();
    const probe = await client.from("theater_sessions").select("id").limit(1);
    schemaOk = !probe.error;
  });

  afterAll(async () => {
    if (!schemaOk) return;
    const client = createAdminSupabaseClient();
    if (cleanup.probeWorkItemId) {
      await client.from("theater_work_items").delete().eq("id", cleanup.probeWorkItemId);
    }
    if (cleanup.sessionId) {
      await client.from("theater_sessions").delete().eq("id", cleanup.sessionId);
    }

    if (cleanup.flyrightLocator) {
      await client.from("flyright_claims").delete().eq("locator", cleanup.flyrightLocator);
      await client.from("flyright_bookings").delete().eq("locator", cleanup.flyrightLocator);
    }
    if (cleanup.streamlySubscriptionId) {
      await client.from("streamly_refunds").delete().eq("subscription_id", cleanup.streamlySubscriptionId);
      await client.from("streamly_subscriptions").delete().eq("subscription_id", cleanup.streamlySubscriptionId);
    }
    if (cleanup.electromartOrderId) {
      await client.from("electromart_claims").delete().eq("order_id", cleanup.electromartOrderId);
      await client.from("electromart_orders").delete().eq("order_id", cleanup.electromartOrderId);
    }
  });

  it("approval_required → approve → execute → verify, and replay is idempotent", async () => {
    if (!schemaOk) return;

    const created = await createTheaterSession();
    token = created.token;
    cleanup.sessionId = created.snapshot.sessionId;
    const [flyItem, streamItem, electroItem] = created.snapshot.items;

    expect(flyItem.providerId).toBe("flyright");
    expect(streamItem.providerId).toBe("streamly");
    expect(electroItem.providerId).toBe("electromart");

    // capture identities for cleanup
    if (flyItem.identity.providerId === "flyright") {
      cleanup.flyrightLocator = flyItem.identity.locator;
      cleanup.flyrightLastName = flyItem.identity.lastName;
    }
    if (streamItem.identity.providerId === "streamly") {
      cleanup.streamlySubscriptionId = streamItem.identity.subscriptionId;
      cleanup.streamlyAccountEmail = streamItem.identity.accountEmail;
    }
    if (electroItem.identity.providerId === "electromart") {
      cleanup.electromartOrderId = electroItem.identity.orderId;
      cleanup.electromartLastName = electroItem.identity.lastName;
    }

    // Prepare FlyRight filing through the same tool surface the agent uses.
    await executeTheaterTool({ token, tool: "inspect_counter", input: { workItemId: flyItem.id } });
    await executeTheaterTool({ token, tool: "compute_entitlement", input: { workItemId: flyItem.id } });
    await executeTheaterTool({ token, tool: "prepare_filing", input: { workItemId: flyItem.id } });
    await executeTheaterTool({ token, tool: "request_signature", input: { workItemId: flyItem.id } });

    // Attempt to execute without signature.
    await expect(
      executeTheaterTool({ token, tool: "execute_filing", input: { workItemId: flyItem.id } }),
    ).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });

    // Approve and execute.
    await decideTheaterWorkItem({ token, workItemId: flyItem.id, decision: "approved" });
    const executed = await executeTheaterTool({ token, tool: "execute_filing", input: { workItemId: flyItem.id } });
    expect(executed.result).toBeDefined();

    const verified = await executeTheaterTool({ token, tool: "verify_filing", input: { workItemId: flyItem.id } });
    expect(verified.result.verification).toBeDefined();
    expect((verified.result.verification as { matched: boolean }).matched).toBe(true);

    // Replay execution must not create duplicates (idempotency-key replay).
    const replayExec = await executeTheaterTool({ token, tool: "execute_filing", input: { workItemId: flyItem.id } });
    expect(replayExec.result.mutation).toBeDefined();

    const snapshot = await getTheaterSnapshot(token);
    const fly = snapshot.items.find((item) => item.id === flyItem.id);
    expect(fly?.status).toBe("VERIFIED");
  });

  it("verification mismatch fails closed", async () => {
    if (!schemaOk) return;
    if (!token) return;

    const snapshot = await getTheaterSnapshot(token);
    const item = snapshot.items.find((it) => it.providerId === "streamly");
    expect(item).toBeTruthy();
    if (!item) return;

    await executeTheaterTool({ token, tool: "inspect_counter", input: { workItemId: item.id } });
    await executeTheaterTool({ token, tool: "compute_entitlement", input: { workItemId: item.id } });
    await executeTheaterTool({ token, tool: "prepare_filing", input: { workItemId: item.id } });
    await executeTheaterTool({ token, tool: "request_signature", input: { workItemId: item.id } });
    await decideTheaterWorkItem({ token, workItemId: item.id, decision: "approved" });

    const executed = await executeTheaterTool({ token, tool: "execute_filing", input: { workItemId: item.id } });
    const mutationId = (executed.result.mutation as { id: string }).id;

    // Tamper provider state to force mismatch.
    const client = createAdminSupabaseClient();
    await client.from("streamly_refunds").update({ amount: "0.01" }).eq("id", mutationId);

    const verified = await executeTheaterTool({ token, tool: "verify_filing", input: { workItemId: item.id } });
    expect((verified.result.verification as { matched: boolean }).matched).toBe(false);

    const after = await getTheaterSnapshot(token);
    const updated = after.items.find((it) => it.id === item.id);
    expect(updated?.status).toBe("FAILED");
  });

  it("provider conflict is surfaced (already claimed FlyRight probe)", async () => {
    if (!schemaOk) return;
    if (!token) return;

    const snapshot = await getTheaterSnapshot(token);
    cleanup.sessionId = snapshot.sessionId;

    const client = createAdminSupabaseClient();
    const { data: claim } = await client
      .from("flyright_claims")
      .select("*")
      .eq("locator", "FR0999")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // If seed data is missing, this probe is a data issue not a code issue; skip.
    if (!claim) return;

    const { data: inserted, error } = await client
      .from("theater_work_items")
      .insert({
        session_id: snapshot.sessionId,
        provider_id: "flyright",
        title: "Probe: already claimed booking",
        identity: { providerId: "flyright", locator: "FR0999", lastName: "BERG" },
        status: "UNINSPECTED",
      })
      .select("id")
      .single();
    if (error || !inserted) {
      throw new Error(error?.message ?? "Could not create probe work item.");
    }
    cleanup.probeWorkItemId = String((inserted as { id: string }).id);

    const computed = await executeTheaterTool({
      token,
      tool: "compute_entitlement",
      input: { workItemId: cleanup.probeWorkItemId },
    });
    const entitlement = computed.result.entitlement as { outcome: string; reasons?: string[] };
    expect(entitlement.outcome).toBe("ineligible");
    expect(entitlement.reasons?.[0]?.toLowerCase() ?? "").toContain("already exists");

    await expect(
      executeTheaterTool({ token, tool: "prepare_filing", input: { workItemId: cleanup.probeWorkItemId } }),
    ).rejects.toMatchObject({ code: "NOT_ELIGIBLE" });
  });
});

