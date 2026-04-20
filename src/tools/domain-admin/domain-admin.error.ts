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
