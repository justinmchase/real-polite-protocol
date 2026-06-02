import { ApplicationError } from "@justinmchase/grove";

export class ContactNotFoundError extends ApplicationError {
  constructor(contactId: string) {
    super(404, "E_CONTACT_NOT_FOUND", `Contact ${contactId} not found`);
  }
}

export class ContactBlockedError extends ApplicationError {
  constructor(contactId: string) {
    super(403, "E_CONTACT_BLOCKED", `Contact ${contactId} is blocked`);
  }
}

export class ContactSenderDomainMismatchError extends ApplicationError {
  constructor(expected: string, actual: string) {
    super(
      403,
      "E_SENDER_DOMAIN_MISMATCH",
      `Envelope sender_domain "${actual}" does not match contact remote_domain "${expected}"`,
    );
  }
}

export class ContactFieldRevisionNotFoundError extends ApplicationError {
  constructor(contactId: string, key: string, recordedAt: Date) {
    super(
      404,
      "E_CONTACT_FIELD_REVISION_NOT_FOUND",
      `Contact ${contactId} field "${key}" has no revision recorded at ${recordedAt.toISOString()}`,
    );
  }
}
