import type { Invitation, Receipt } from "../../models/mod.ts";
import type { InvitationRepository } from "../../repositories/mod.ts";
import type { ReceiptManager } from "../receipt/receipt.manager.ts";
import {
  InvitationNotFoundError,
  InvitationNotPendingError,
} from "./invitation.error.ts";

export class InvitationManager {
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly receiptManager: ReceiptManager,
  ) {}

  async createInvitation(
    invitationId: string,
    receiverOid: string,
    senderDomain: string,
    proposedTerms: Record<string, unknown>,
    claims: { user_verified?: Record<string, unknown>; admin_verified?: Record<string, unknown>; custom?: Record<string, unknown> } | undefined,
    expiresAt: string | undefined,
    messageId?: string,
  ): Promise<Invitation> {
    const invitation: Invitation = {
      invitation_id: invitationId,
      receiver_oid: receiverOid,
      sender_domain: senderDomain,
      status: "pending",
      proposed_terms: proposedTerms as Record<string, unknown>,
      ...(claims !== undefined && { claims }),
      ...(expiresAt !== undefined && { expires_at: expiresAt }),
      created_at: new Date().toISOString(),
      message_id: messageId,
    };
    return await this.invitations.set(invitation);
  }

  async getInvitation(invitationId: string): Promise<Invitation | undefined> {
    return await this.invitations.get(invitationId);
  }

  async listByReceiver(oid: string): Promise<Invitation[]> {
    return await this.invitations.listByReceiver(oid);
  }

  /**
   * Accept a pending invitation and issue a receipt to the sender domain.
   * Returns both the updated invitation and the newly issued receipt.
   */
  async accept(
    invitationId: string,
    negotiatedTerms?: Record<string, unknown>,
  ): Promise<{ invitation: Invitation; receipt: Receipt }> {
    const invitation = await this.invitations.get(invitationId);
    if (!invitation) {
      throw new InvitationNotFoundError(invitationId);
    }

    if (invitation.status !== "pending") {
      throw new InvitationNotPendingError(invitationId, invitation.status);
    }

    const acceptedTerms = negotiatedTerms ?? invitation.proposed_terms;

    const updated: Invitation = {
      ...invitation,
      status: "accepted",
      accepted_at: new Date().toISOString(),
      proposed_terms: acceptedTerms,
    };
    const savedInvitation = await this.invitations.set(updated);

    const receipt = await this.receiptManager.issue(
      invitation.receiver_oid,
      invitation.sender_domain,
      acceptedTerms,
      invitation.invitation_id,
    );

    return { invitation: savedInvitation, receipt };
  }

  async reject(invitationId: string): Promise<Invitation> {
    const invitation = await this.invitations.get(invitationId);
    if (!invitation) {
      throw new InvitationNotFoundError(invitationId);
    }

    const updated: Invitation = {
      ...invitation,
      status: "rejected",
    };
    return await this.invitations.set(updated);
  }

  async cancel(invitationId: string): Promise<Invitation> {
    const invitation = await this.invitations.get(invitationId);
    if (!invitation) {
      throw new InvitationNotFoundError(invitationId);
    }

    const updated: Invitation = {
      ...invitation,
      status: "cancelled",
    };
    return await this.invitations.set(updated);
  }
}

