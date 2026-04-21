import { ApplicationError } from "@justinmchase/grove";

export class UserVerifiedMetadataNotFoundError extends ApplicationError {
  constructor(oid: string) {
    super(
      404,
      "E_USER_VERIFIED_METADATA_NOT_FOUND",
      `No verified metadata found for oid ${oid}`,
    );
  }
}

export class AccountNotFoundError extends ApplicationError {
  constructor(oid: string) {
    super(
      404,
      "E_ACCOUNT_NOT_FOUND",
      `No registered account found for oid ${oid}`,
    );
  }
}

export class VerifiedMetadataValueTooLongError extends ApplicationError {
  constructor(field: string, maxLength: number) {
    super(
      400,
      "E_VERIFIED_METADATA_VALUE_TOO_LONG",
      `Verified metadata value for field ${field} exceeds maximum length ${maxLength}`,
    );
  }
}

export class AdminVerifiedMetadataFieldNotFoundError extends ApplicationError {
  constructor(oid: string, field: string) {
    super(
      404,
      "E_ADMIN_VERIFIED_METADATA_FIELD_NOT_FOUND",
      `No admin verified metadata field ${field} found for oid ${oid}`,
    );
  }
}
