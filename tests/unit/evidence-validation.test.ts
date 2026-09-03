import { describe, expect, it } from "vitest";
import {
  EvidenceValidationError,
  assertAllowedEvidenceUpload,
} from "@/src/domain/evidence/validation";

describe("evidence validation", () => {
  it("accepts allowed PDF uploads under the size limit", () => {
    expect(() =>
      assertAllowedEvidenceUpload({
        contentType: "application/pdf",
        byteSize: 1024,
        filename: "invoice.pdf",
      }),
    ).not.toThrow();
  });

  it("rejects disallowed types and oversized files", () => {
    expect(() =>
      assertAllowedEvidenceUpload({
        contentType: "application/zip",
        byteSize: 100,
        filename: "x.zip",
      }),
    ).toThrow(EvidenceValidationError);

    expect(() =>
      assertAllowedEvidenceUpload({
        contentType: "application/pdf",
        byteSize: 11 * 1024 * 1024,
        filename: "big.pdf",
      }),
    ).toThrow(EvidenceValidationError);
  });
});
