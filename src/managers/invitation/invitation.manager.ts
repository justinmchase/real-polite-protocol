import type {
  CommunicationTerms,
  ContactCredential,
  Invitation,
  InvitationClaims,
  InvitationDirection,
} from "../../models/mod.ts";
import type {
  InvitationRepository,
  ListInvitationsOptions,
  ListInvitationsResult,
} from "../../repositories/mod.ts";
import {
  InvitationDirectionMismatchError,
  InvitationNotFoundError,
  InvitationNotPendingError,
} from "./invitation.error.ts";

export interface CreateInboundInvitationInput {
  invitationId: string;
  ownerOid: string;
  remoteDomain: string;
  communicationTerms: CommunicationTerms;
  replyCredential: ContactCredential;
  claims?: InvitationClaims;
  senderDisplayName?: string;
  message?: string;
  expiresAt?: Date;
  sentAt: Date;
  recordedAt: Date;
}

export interface CreateOutboundInvitationInput {
  invitationId: string;
  ownerOid: string;
  remoteDomain: string;
  communicationTerms: CommunicationTerms;
  replyCredential: ContactCredential;
  claims?: InvitationClaims;
  senderDisplayName?: string;
  message?: string;
  expiresAt?: Date;
  sentAt: Date;
  recordedAt: Date;
}

export class InvitationManager {
  constructor(private readonly invitations: InvitationRepository) {}

  async createInbound(
    input: CreateInboundInvitationInput,
  ): Promise<Invitation> {
    const invitation: Invitation = {
      invitation_id: input.invitationId,
      direction: "inbound",
      owner_oid: input.ownerOid,
      remote_domain: input.remoteDomain,
      status: "pending",
      communication_terms: input.communicationTerms,
      reply_credential: input.replyCredential,
      ...(input.claims !== undefined && { claims: input.claims }),
      ...(input.senderDisplayName !== undefined && {
        sender_display_name: input.senderDisplayName,
      }),
      ...(input.message !== undefined && { message: input.message }),
      ...(input.expiresAt !== undefined && { expires_at: input.expiresAt }),
      sent_at: input.sentAt,
      created_at: input.recordedAt,
    };
    return await this.invitations.set(invitation);
  }

  async createOutbound(
    input: CreateOutboundInvitationInput,
  ): Promise<Invitation> {
    const invitation: Invitation = {
      invitation_id: input.invitationId,
      direction: "outbound",
      owner_oid: input.ownerOid,
      remote_domain: input.remoteDomain,
      status: "pending",
      communication_terms: input.communicationTerms,
      reply_credential: input.replyCredential,
      ...(input.claims !== undefined && { claims: input.claims }),
      ...(input.senderDisplayName !== undefined && {
        sender_display_name: input.senderDisplayName,
      }),
      ...(input.message !== undefined && { message: input.message }),
      ...(input.expiresAt !== undefined && { expires_at: input.expiresAt }),
      sent_at: input.sentAt,
      created_at: input.recordedAt,
    };
    return await this.invitations.set(invitation);
  }

  async get(
    ownerOid: string,
    invitationId: string,
  ): Promise<Invitation | undefined> {
    return await this.invitations.get(ownerOid, invitationId);
  }

  async require(
    ownerOid: string,
    invitationId: string,
  ): Promise<Invitation> {
    const invitation = await this.invitations.get(ownerOid, invitationId);
    if (!invitation) throw new InvitationNotFoundError(invitationId);
    return invitation;
  }

  async requireDirection(
    ownerOid: string,
    invitationId: string,
    direction: InvitationDirection,
  ): Promise<Invitation> {
    const invitation = await this.require(ownerOid, invitationId);
    if (invitation.direction !== direction) {
      throw new InvitationDirectionMismatchError(
        invitationId,
        direction,
        invitation.direction,
      );
    }
    return invitation;
  }

  /**
   * Server-internal: resolve which local account owns the invitation with
   * this id + direction. Used by the submit handler to look up the local
   * record without trusting any caller-provided oid.
   */
  async findOwner(
    invitationId: string,
    direction: InvitationDirection,
  ): Promise<string | undefined> {
    return await this.invitations.findOwner(invitationId, direction);
  }

  /**
   * Server-internal: look up an invitation by id + direction. Resolves the
   * owner via the reverse index and returns the record (or throws).
   */
  async requireByIdAndDirection(
    invitationId: string,
    direction: InvitationDirection,
  ): Promise<Invitation> {
    const ownerOid = await this.invitations.findOwner(invitationId, direction);
    if (!ownerOid) throw new InvitationNotFoundError(invitationId);
    return await this.require(ownerOid, invitationId);
  }

  async list(
    ownerOid: string,
    opts?: ListInvitationsOptions,
  ): Promise<ListInvitationsResult> {
    return await this.invitations.listByOwner(ownerOid, opts);
  }

  /**
   * Mark an inbound invitation as accepted. Caller is responsible for
   * creating the contact and dispatching the `invitation_reply` envelope
   * (spec §10.4).
   */
  async accept(
    ownerOid: string,
    invitationId: string,
    decidedAt: Date,
  ): Promise<Invitation> {
    const invitation = await this.requireDirection(
      ownerOid,
      invitationId,
      "inbound",
    );
    if (invitation.status !== "pending") {
      throw new InvitationNotPendingError(invitationId, invitation.status);
    }
    return await this.invitations.set({
      ...invitation,
      status: "accepted",
      decided_at: decidedAt,
    });
  }

  async reject(
    ownerOid: string,
    invitationId: string,
    decidedAt: Date,
  ): Promise<Invitation> {
    const invitation = await this.requireDirection(
      ownerOid,
      invitationId,
      "inbound",
    );
    if (invitation.status !== "pending") {
      throw new InvitationNotPendingError(invitationId, invitation.status);
    }
    return await this.invitations.set({
      ...invitation,
      status: "rejected",
      decided_at: decidedAt,
    });
  }

  /**
   * Mark an inbound invitation as `cancelled` after a remote cancellation
   * envelope (spec §10.3).
   */
  async cancel(
    ownerOid: string,
    invitationId: string,
    decidedAt: Date,
  ): Promise<Invitation> {
    const invitation = await this.requireDirection(
      ownerOid,
      invitationId,
      "inbound",
    );
    if (invitation.status !== "pending") {
      throw new InvitationNotPendingError(invitationId, invitation.status);
    }
    return await this.invitations.set({
      ...invitation,
      status: "cancelled",
      decided_at: decidedAt,
    });
  }

  /**
   * Mark an outbound invitation as `cancelled` after the local user dispatched
   * a cancellation envelope to the remote (spec §10.3, sender side).
   */
  async cancelOutbound(
    ownerOid: string,
    invitationId: string,
    decidedAt: Date,
  ): Promise<Invitation> {
    const invitation = await this.requireDirection(
      ownerOid,
      invitationId,
      "outbound",
    );
    if (invitation.status !== "pending") {
      throw new InvitationNotPendingError(invitationId, invitation.status);
    }
    return await this.invitations.set({
      ...invitation,
      status: "cancelled",
      decided_at: decidedAt,
    });
  }

  /**
   * Mark an outbound invitation as accepted by the remote, after a valid
   * `invitation_reply` envelope was received (spec §10.4 + §11.2 path 2).
   */
  async markOutboundAccepted(
    ownerOid: string,
    invitationId: string,
    decidedAt: Date,
  ): Promise<Invitation> {
    const invitation = await this.requireDirection(
      ownerOid,
      invitationId,
      "outbound",
    );
    if (invitation.status !== "pending") {
      throw new InvitationNotPendingError(invitationId, invitation.status);
    }
    return await this.invitations.set({
      ...invitation,
      status: "accepted",
      decided_at: decidedAt,
    });
  }

  async expire(
    ownerOid: string,
    invitationId: string,
    decidedAt: Date,
  ): Promise<Invitation> {
    const invitation = await this.require(ownerOid, invitationId);
    if (invitation.status !== "pending") {
      throw new InvitationNotPendingError(invitationId, invitation.status);
    }
    return await this.invitations.set({
      ...invitation,
      status: "expired",
      decided_at: decidedAt,
    });
  }
}
