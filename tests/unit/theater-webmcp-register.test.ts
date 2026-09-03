import { describe, expect, it } from "vitest";
import { ledgerCopy } from "@/src/domain/theater/ledger";
import {
  normalizeWebMcpTools,
  registerTheaterTools,
} from "@/components/theater/register-theater-tools";

describe("theater ledger and registration", () => {
  it("translates permission failures into human copy", () => {
    const copy = ledgerCopy({ name: "execute_filing", ok: false, code: "APPROVAL_REQUIRED" });
    expect(copy.headline).toMatch(/signature required/i);
  });

  it("explains inspect and verify in plain language", () => {
    expect(ledgerCopy({ name: "inspect_counter", ok: true }).headline).toMatch(/live provider row/i);
    expect(ledgerCopy({ name: "verify_filing", ok: true }).headline).toMatch(/re-read/i);
  });

  it("normalizes non-array getTools() host shapes without throwing", () => {
    const tool = {
      name: "begin_resolution",
      description: "x",
      inputSchema: {},
      execute: async () => ({}),
    };
    expect(normalizeWebMcpTools(null)).toEqual([]);
    expect(normalizeWebMcpTools({ tools: [tool] })).toHaveLength(1);
    expect(normalizeWebMcpTools({ begin_resolution: tool })).toHaveLength(1);
    expect(normalizeWebMcpTools({ notATool: 1 })).toEqual([]);
  });

  it("registers even when getTools returns a non-array, and refreshes execute", async () => {
    const byName: Record<
      string,
      {
        name: string;
        description: string;
        inputSchema: Record<string, unknown>;
        execute: (input: Record<string, unknown>) => Promise<unknown>;
      }
    > = {};
    const context = {
      registerTool: (tool: (typeof byName)[string]) => {
        if (byName[tool.name]) {
          throw new Error("already registered");
        }
        byName[tool.name] = tool;
      },
      // Host bug reproduction: object map, not Array — .find would throw.
      getTools: () => byName as unknown as Array<(typeof byName)[string]>,
    };

    const first = registerTheaterTools(context, async () => ({ generation: 1 }));
    expect(first).toHaveLength(10);
    expect(Object.keys(byName)).toHaveLength(10);

    const second = registerTheaterTools(context, async () => ({ generation: 2 }));
    expect(second).toHaveLength(10);
    const begin = byName.begin_resolution;
    expect(begin).toBeTruthy();
    await expect(begin!.execute({})).resolves.toEqual({ generation: 2 });
  });

  it("explains orchestration tools in plain language", () => {
    expect(ledgerCopy({ name: "begin_resolution", ok: true }).headline).toMatch(/signatures required/i);
    expect(ledgerCopy({ name: "continue_resolution", ok: true }).headline).toMatch(/verified/i);
  });
});
