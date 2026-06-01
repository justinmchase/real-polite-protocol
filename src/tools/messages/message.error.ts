import { ApplicationError } from "@justinmchase/grove";

export class InvalidContentTypeError extends ApplicationError {
  constructor(contentType: string) {
    super(
      400,
      "E_INVALID_CONTENT_TYPE",
      `Unsupported content_type: "${contentType}". Must be "text/markdown" or "application/json".`,
    );
  }
}

export class InvalidBodyError extends ApplicationError {
  constructor(reason: string) {
    super(400, "E_INVALID_BODY", `Message body is invalid: ${reason}`);
  }
}

export class ContactNotReadyError extends ApplicationError {
  constructor(contactId: string) {
    super(
      400,
      "E_CONTACT_NOT_READY",
      `Contact ${contactId} is blocked or otherwise unavailable for outbound messaging.`,
    );
  }
}

export class MessageDeliveryError extends ApplicationError {
  constructor(domain: string, httpStatus: number, receiverCode?: string) {
    super(
      400,
      "E_DELIVERY_FAILED",
      `Failed to deliver message to ${domain}: HTTP ${httpStatus}${
        receiverCode ? ` (${receiverCode})` : ""
      }`,
    );
  }
}

export class MessageNotFoundError extends ApplicationError {
  constructor(messageId: string) {
    super(
      404,
      "E_MESSAGE_NOT_FOUND",
      `Message ${messageId} not found`,
    );
  }
}

export class CategoryNotPermittedError extends ApplicationError {
  constructor(category: string) {
    super(
      400,
      "E_CATEGORY_NOT_PERMITTED",
      `Category "${category}" is not in this contact's negotiated remote_terms.categories.`,
    );
  }
}

export class ContentRatingNotPermittedError extends ApplicationError {
  constructor(rating: string, max: string) {
    super(
      400,
      "E_CONTENT_RATING_NOT_PERMITTED",
      `Content rating "${rating}" exceeds the contact's negotiated max_content_rating "${max}".`,
    );
  }
}
