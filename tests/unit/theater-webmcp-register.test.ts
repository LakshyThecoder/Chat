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

  it("does not duplicate tools on remount", () => {
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
    const first = registerTheaterTools(context, async () => ({}));
    const second = registerTheaterTools(context, async () => ({}));
    expect(first).toHaveLength(8);
    expect(second).toHaveLength(8);
    expect(registered).toHaveLength(8);
  });
});
