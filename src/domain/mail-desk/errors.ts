export class MailDeskError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "MailDeskError";
  }
}

export class MailDeskPermissionError extends Error {
  constructor(
    readonly code: "APPROVAL_REQUIRED" | "DENIED",
    message: string,
  ) {
    super(message);
    this.name = "MailDeskPermissionError";
  }
}
