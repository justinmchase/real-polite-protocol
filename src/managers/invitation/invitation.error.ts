import { ApplicationError } from "@justinmchase/grove";

export class InvitationNotFoundError extends ApplicationError {
  constructor(invitationId: string) {
    super(404, "E_INVITATION_NOT_FOUND", `Invitation ${invitationId} not found`);
  }
}

export class InvitationNotPendingError extends ApplicationError {
  constructor(invitationId: string, currentStatus: string) {
    super(
      400,
      "E_INVITATION_NOT_PENDING",
      `Invitation ${invitationId} cannot be accepted: current status is "${currentStatus}"`,
    );
  }
}
