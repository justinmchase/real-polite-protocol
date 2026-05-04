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

export class ReceiptNotActiveError extends ApplicationError {
  constructor(receiptId: string) {
    super(
      400,
      "E_RECEIPT_NOT_ACTIVE",
      `Receipt ${receiptId} is not active (revoked or expired)`,
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

export class InvalidReplyInviteError extends ApplicationError {
  constructor(receptivePolicyId: string) {
    super(
      400,
      "E_INVALID_REPLY_INVITE",
      `reply_invite.receptive_policy_id ${receptivePolicyId} is not an active receptive policy owned by you. ` +
        `Create one with open_receptive_window first, or omit reply_invite.`,
    );
  }
}
