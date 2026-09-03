import { describe, expect, it } from "vitest";
import { ledgerCopy } from "@/src/domain/theater/ledger";
import { registerTheaterTools } from "@/components/theater/register-theater-tools";

describe("theater ledger and registration", () => {
  it("translates permission failures into human copy", () => {
    const copy = ledgerCopy({ name: "execute_filing", ok: false, code: "APPROVAL_REQUIRED" });
    expect(copy.headline).toMatch(/signature required/i);
  });

  it("explains inspect and verify in plain language", () => {
    expect(ledgerCopy({ name: "inspect_counter", ok: true }).headline).toMatch(/live provider row/i);
    expect(ledgerCopy({ name: "verify_filing", ok: true }).headline).toMatch(/re-read/i);
  });

  it("does not duplicate tools on remount and refreshes execute handlers", async () => {
    const registered: Array<{
      name: string;
      description: string;
      inputSchema: Record<string, unknown>;
      execute: (input: Record<string, unknown>) => Promise<unknown>;
    }> = [];
    const context = {
      registerTool: (tool: (typeof registered)[number]) => {
        registered.push(tool);
      },
      getTools: () => registered,
    };
    let generation = 0;
    const first = registerTheaterTools(context, async () => ({ generation: 1 }));
    generation = 2;
    const second = registerTheaterTools(context, async () => ({ generation }));
    expect(first).toHaveLength(10);
    expect(second).toHaveLength(10);
    expect(registered).toHaveLength(10);
    const begin = registered.find((tool) => tool.name === "begin_resolution");
    await expect(begin?.execute({})).resolves.toEqual({ generation: 2 });
  });

  it("explains orchestration tools in plain language", () => {
    expect(ledgerCopy({ name: "begin_resolution", ok: true }).headline).toMatch(/signatures required/i);
    expect(ledgerCopy({ name: "continue_resolution", ok: true }).headline).toMatch(/verified/i);
  });
});
