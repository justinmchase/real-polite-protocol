import { ApplicationError } from "@justinmchase/grove";

export class ActiveKeyDeletionError extends ApplicationError {
  constructor(keyId: string) {
    super(
      400,
      "E_ACTIVE_KEY_DELETION",
      `Key ${keyId} is the active verification key and cannot be deleted`,
    );
  }
}
