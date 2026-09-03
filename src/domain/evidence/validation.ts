export const ALLOWED_EVIDENCE_CONTENT_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
] as const;

export type AllowedEvidenceContentType = (typeof ALLOWED_EVIDENCE_CONTENT_TYPES)[number];

export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;

export class EvidenceValidationError extends Error {
  readonly code = "EVIDENCE_VALIDATION_FAILED";

  constructor(message: string) {
    super(message);
    this.name = "EvidenceValidationError";
  }
}

export function assertAllowedEvidenceUpload(input: {
  contentType: string;
  byteSize: number;
  filename: string;
}): asserts input is {
  contentType: AllowedEvidenceContentType;
  byteSize: number;
  filename: string;
} {
  if (!input.filename.trim()) {
    throw new EvidenceValidationError("Filename is required");
  }

  if (input.byteSize <= 0 || input.byteSize > MAX_EVIDENCE_BYTES) {
    throw new EvidenceValidationError("File exceeds the 10MB size limit");
  }

  if (
    !ALLOWED_EVIDENCE_CONTENT_TYPES.includes(
      input.contentType as AllowedEvidenceContentType,
    )
  ) {
    throw new EvidenceValidationError("File type is not allowed");
  }
}
