import { ApplicationError } from "@justinmchase/grove";

export class ReceiptNotFoundError extends ApplicationError {
  constructor(receiptId: string) {
    super(404, "E_RECEIPT_NOT_FOUND", `Receipt ${receiptId} not found`);
  }
}

export class ReceiptAlreadyRevokedError extends ApplicationError {
  constructor(receiptId: string) {
    super(
      400,
      "E_RECEIPT_ALREADY_REVOKED",
      `Receipt ${receiptId} is already revoked`,
    );
  }
}

export class ReceiptNotOwnedError extends ApplicationError {
  constructor(receiptId: string) {
    super(
      403,
      "E_RECEIPT_NOT_OWNED",
      `Receipt ${receiptId} was not issued by this account`,
    );
  }
}
