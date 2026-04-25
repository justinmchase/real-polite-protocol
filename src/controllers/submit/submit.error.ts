import { ApplicationError } from "@justinmchase/grove";

export class MissingReceiptIdError extends ApplicationError {
  constructor() {
    super(
      400,
      "E_MISSING_RECEIPT_ID",
      "x-rpp-receipt-id header is required",
    );
  }
}

export class MissingSignatureError extends ApplicationError {
  constructor() {
    super(
      400,
      "E_MISSING_SIGNATURE",
      "x-rpp-signature header is required",
    );
  }
}

export class MissingTimestampError extends ApplicationError {
  constructor() {
    super(
      400,
      "E_MISSING_TIMESTAMP",
      "x-rpp-timestamp header is required",
    );
  }
}

export class ReceiptNotFoundError extends ApplicationError {
  constructor(receiptId: string) {
    super(
      403,
      "E_RECEIPT_NOT_FOUND",
      `Receipt ${receiptId} not found`,
    );
  }
}

export class ReceiptInvalidSignatureError extends ApplicationError {
  constructor() {
    super(
      403,
      "E_RECEIPT_INVALID_SIGNATURE",
      "Request signature does not match computed HMAC",
    );
  }
}

export class InvalidRequestBodyError extends ApplicationError {
  constructor(reason: string) {
    super(
      400,
      "E_INVALID_REQUEST_BODY",
      `Invalid request body: ${reason}`,
    );
  }
}

export class InvalidMessageEnvelopeError extends ApplicationError {
  constructor(reason: string) {
    super(
      400,
      "E_INVALID_MESSAGE_ENVELOPE",
      `Invalid message envelope: ${reason}`,
    );
  }
}

export class MissingReceptivePolicyIdError extends ApplicationError {
  constructor() {
    super(
      400,
      "E_MISSING_RECEPTIVE_POLICY_ID",
      "Invitation message missing required metadata.receptive_policy_id",
    );
  }
}

export class ReceptivePolicyNotFoundError extends ApplicationError {
  constructor(policyId: string) {
    super(
      403,
      "E_RECEPTIVE_POLICY_NOT_FOUND",
      `Receptive policy ${policyId} not found`,
    );
  }
}

export class ReceptivePolicyExpiredError extends ApplicationError {
  constructor(policyId: string) {
    super(
      403,
      "E_RECEPTIVE_POLICY_EXPIRED",
      `Receptive policy ${policyId} has expired`,
    );
  }
}

export class ReceptivePolicyClosedError extends ApplicationError {
  constructor(policyId: string) {
    super(
      403,
      "E_RECEPTIVE_POLICY_CLOSED",
      `Receptive policy ${policyId} is closed`,
    );
  }
}

export class ReceiptNotActiveError extends ApplicationError {
  constructor(receiptId: string) {
    super(
      403,
      "E_RECEIPT_NOT_ACTIVE",
      `Receipt ${receiptId} is not active`,
    );
  }
}

export class MessageTooLargeError extends ApplicationError {
  constructor(size: number, maxSize: number = 262144) {
    super(
      413,
      "E_MESSAGE_TOO_LARGE",
      `Message size ${size} exceeds maximum ${maxSize}`,
    );
  }
}

export class RequestStaleError extends ApplicationError {
  constructor(diffSeconds: number) {
    super(
      400,
      "E_REQUEST_STALE",
      `Request timestamp is ${diffSeconds} seconds outside the 60-second freshness window`,
    );
  }
}

export class DuplicateMessageError extends ApplicationError {
  constructor(messageId: string) {
    super(
      400,
      "E_DUPLICATE_MESSAGE",
      `message_id ${messageId} has already been accepted from this sender domain`,
    );
  }
}

export class ReceiptRevokedError extends ApplicationError {
  constructor(receiptId: string) {
    super(403, "E_RECEIPT_REVOKED", `Receipt ${receiptId} has been revoked`);
  }
}

export class ReceiptExpiredError extends ApplicationError {
  constructor(receiptId: string) {
    super(403, "E_RECEIPT_EXPIRED", `Receipt ${receiptId} has expired`);
  }
}
