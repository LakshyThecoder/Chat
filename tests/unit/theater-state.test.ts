import { describe, expect, it } from "vitest";
import { TheaterSessionError } from "@/src/domain/theater/errors";
import {
  decideAction,
  executeMode,
  inspectNextStatus,
  nextActionsFor,
  prepareAction,
  requestSignatureAction,
} from "@/src/domain/theater/state";

describe("theater state machine", () => {
  it("does not let prepare erase a signature", () => {
    expect(prepareAction("AWAITING_SIGNATURE")).toBe("replay");
    expect(prepareAction("APPROVED")).toBe("replay");
    expect(prepareAction("EXECUTED")).toBe("replay");
    expect(prepareAction("VERIFIED")).toBe("replay");
    expect(prepareAction("PREPARED")).toBe("replay");
    expect(prepareAction("ENTITLED")).toBe("advance");
    expect(prepareAction("DENIED")).toBe("reject");
    expect(prepareAction("FAILED")).toBe("reject");
  });

  it("accepts signatures only from AWAITING_SIGNATURE", () => {
    expect(
      decideAction({ status: "AWAITING_SIGNATURE", hasProposal: true, decision: "approved" }),
    ).toBe("apply");
    expect(decideAction({ status: "APPROVED", hasProposal: true, decision: "approved" })).toBe("replay");
    expect(() =>
      decideAction({ status: "PREPARED", hasProposal: true, decision: "approved" }),
    ).toThrow(TheaterSessionError);
  });

  it("rejects decide without a proposal", () => {
    expect(() =>
      decideAction({ status: "AWAITING_SIGNATURE", hasProposal: false, decision: "denied" }),
    ).toThrow(/not prepared/i);
  });

  it("replays execute when a mutation already exists", () => {
    expect(executeMode({ status: "EXECUTED", lastMutationId: "abc" })).toBe("replay");
    expect(executeMode({ status: "VERIFIED", lastMutationId: "abc" })).toBe("replay");
    expect(executeMode({ status: "FAILED", lastMutationId: "abc" })).toBe("replay");
    expect(executeMode({ status: "FAILED", lastMutationId: null })).toBe("retry");
    expect(executeMode({ status: "APPROVED", lastMutationId: null })).toBe("mutate");
  });

  it("does not regress inspect status", () => {
    expect(inspectNextStatus("UNINSPECTED")).toBe("INSPECTED");
    expect(inspectNextStatus("APPROVED")).toBe("APPROVED");
  });

  it("hides file actions for blocked and ineligible rows", () => {
    expect(
      nextActionsFor({ status: "ENTITLED", catalogBlocked: true, eligible: false, hasMutation: false }),
    ).toEqual([]);
    expect(
      nextActionsFor({ status: "APPROVED", catalogBlocked: false, eligible: true, hasMutation: false }),
    ).toEqual(["execute_filing"]);
  });

  it("asks for signature only after prepare", () => {
    expect(requestSignatureAction("PREPARED")).toBe("advance");
    expect(requestSignatureAction("AWAITING_SIGNATURE")).toBe("replay");
    expect(requestSignatureAction("INSPECTED")).toBe("reject");
  });
});
