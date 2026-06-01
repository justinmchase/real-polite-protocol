import { ApplicationError } from "@justinmchase/grove";

// ----- Transport / framing -----

export class EnvelopeTooLargeError extends ApplicationError {
  constructor(size: number, maxSize: number = 262144) {
    super(
      413,
      "E_ENVELOPE_TOO_LARGE",
      `Envelope size ${size} exceeds maximum ${maxSize}`,
    );
  }
}

export class InvalidRequestBodyError extends ApplicationError {
  constructor(reason: string) {
    super(400, "E_INVALID_REQUEST_BODY", `Invalid request body: ${reason}`);
  }
}

// ----- Envelope schema -----

export class InvalidMessageEnvelopeError extends ApplicationError {
  constructor(reason: string) {
    super(
      400,
      "E_INVALID_MESSAGE_ENVELOPE",
      `Invalid message envelope: ${reason}`,
    );
  }
}

export class InvalidInvitationEnvelopeError extends ApplicationError {
  constructor(reason: string) {
    super(
      400,
      "E_INVALID_INVITATION_ENVELOPE",
      `Invalid invitation envelope: ${reason}`,
    );
  }
}

export class InvalidReplyCredentialError extends ApplicationError {
  constructor(reason: string) {
    super(400, "E_INVALID_REPLY_CREDENTIAL", reason);
  }
}

export class InvalidContentTypeError extends ApplicationError {
  constructor(contentType: string) {
    super(
      400,
      "E_INVALID_CONTENT_TYPE",
      `content_type "${contentType}" is not permitted; must be "text/markdown" or "application/json"`,
    );
  }
}

export class InvalidBodyError extends ApplicationError {
  constructor(reason: string) {
    super(400, "E_INVALID_BODY", `Invalid body: ${reason}`);
  }
}

// ----- Auth headers -----

export class InvalidAuthHeadersError extends ApplicationError {
  constructor(reason: string) {
    super(400, "E_INVALID_AUTH_HEADERS", reason);
  }
}

export class MissingContactIdError extends ApplicationError {
  constructor() {
    super(400, "E_MISSING_CONTACT_ID", "x-rpp-contact-id header is required");
  }
}

export class MissingReceptivePolicyIdError extends ApplicationError {
  constructor() {
    super(
      400,
      "E_MISSING_RECEPTIVE_POLICY_ID",
      "Invitation envelope missing receptive_policy_id and shortcode",
    );
  }
}

export class MissingSignatureError extends ApplicationError {
  constructor() {
    super(400, "E_MISSING_SIGNATURE", "x-rpp-signature header is required");
  }
}

export class MissingTimestampError extends ApplicationError {
  constructor() {
    super(400, "E_MISSING_TIMESTAMP", "x-rpp-timestamp header is required");
  }
}

// ----- Replay protection -----

export class RequestStaleError extends ApplicationError {
  constructor(diffSeconds: number) {
    super(
      400,
      "E_REQUEST_STALE",
      `Request timestamp is ${diffSeconds} seconds outside the 60-second freshness window`,
    );
  }
}

export class DuplicateEnvelopeError extends ApplicationError {
  constructor(envelopeId: string) {
    super(
      400,
      "E_DUPLICATE_ENVELOPE",
      `Envelope ${envelopeId} has already been accepted from this sender domain`,
    );
  }
}

// ----- HMAC / contact authorization -----

export class SignatureInvalidError extends ApplicationError {
  constructor() {
    super(
      403,
      "E_SIGNATURE_INVALID",
      "Request signature does not match computed HMAC",
    );
  }
}

/**
 * Submit-side variant of contact-not-found. The contact-tool variant (404) is
 * raised by `ContactManager` for resource-lookup paths; this 403 variant is
 * raised by the envelope endpoint when credential resolution fails.
 */
export class SubmitContactNotFoundError extends ApplicationError {
  constructor(contactId: string) {
    super(
      403,
      "E_CONTACT_NOT_FOUND",
      `x-rpp-contact-id ${contactId} does not resolve to any contact`,
    );
  }
}

// ----- Receptive policy resolution (invitation envelopes) -----

export class ReceptivePolicyNotFoundError extends ApplicationError {
  constructor(identifier: string) {
    super(
      403,
      "E_RECEPTIVE_POLICY_NOT_FOUND",
      `Receptive policy ${identifier} not found`,
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
      `Receptive policy ${policyId} is closed to the supplied sender`,
    );
  }
}

// ----- Soft-term enforcement (spec §10.1 / contacts-011) -----

export class CategoryNotPermittedError extends ApplicationError {
  constructor(category: string) {
    super(
      403,
      "E_CATEGORY_NOT_PERMITTED",
      `Message category "${category}" is not permitted by the receiver's local_terms`,
    );
  }
}

export class ContentRatingNotPermittedError extends ApplicationError {
  constructor(rating: string, max: string) {
    super(
      403,
      "E_CONTENT_RATING_NOT_PERMITTED",
      `Message content_rating "${rating}" exceeds the receiver's local_terms.max_content_rating "${max}"`,
    );
  }
}
