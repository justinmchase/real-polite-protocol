import type {
  Invitation,
  InvitationClaims,
  Receipt,
  ReceiptTerms,
} from "../../models/mod.ts";
import type { InvitationRepository } from "../../repositories/mod.ts";
import type { ContactManager } from "../contacts/contact.manager.ts";
import type { ReceiptManager } from "../receipt/receipt.manager.ts";
import type { ReceptivePolicyManager } from "../receptive-policy/receptive-policy.manager.ts";
import {
  InvitationNotFoundError,
  InvitationNotPendingError,
} from "./invitation.error.ts";

export class InvitationManager {
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly receiptManager: ReceiptManager,
    private readonly contactManager: ContactManager,
    private readonly receptivePolicyManager: ReceptivePolicyManager,
  ) {}

  async createInvitation(
    invitationId: string,
    receiverOid: string,
    senderDomain: string,
    proposedTerms: ReceiptTerms,
    claims: InvitationClaims | undefined,
    expiresAt: string | undefined,
    messageId?: string,
  ): Promise<Invitation> {
    const invitation: Invitation = {
      invitation_id: invitationId,
      receiver_oid: receiverOid,
      sender_domain: senderDomain,
      status: "pending",
      proposed_terms: proposedTerms,
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
    negotiatedTerms?: ReceiptTerms,
  ): Promise<{ invitation: Invitation; receipt: Receipt }> {
    const invitation = await this.invitations.get(invitationId);
    if (!invitation) {
      throw new InvitationNotFoundError(invitationId);
    }

    if (invitation.status !== "pending") {
      throw new InvitationNotPendingError(invitationId, invitation.status);
    }

    const acceptedTerms = negotiatedTerms ?? invitation.proposed_terms;
    const acceptedAt = new Date().toISOString();

    const updated: Invitation = {
      ...invitation,
      status: "accepted",
      accepted_at: acceptedAt,
      proposed_terms: acceptedTerms,
    };
    const savedInvitation = await this.invitations.set(updated);

    // Revoke any existing receipts from the same sender identity before issuing.
    const senderDomainId = invitation.claims?.immutable?.domain_id;
    const senderDomainIdStr = typeof senderDomainId === "string"
      ? senderDomainId
      : undefined;
    if (senderDomainIdStr) {
      await this.receiptManager.revokeSuperseded(
        invitation.receiver_oid,
        invitation.sender_domain,
        senderDomainIdStr,
        acceptedAt,
      );
    }

    const receipt = await this.receiptManager.issue(
      invitation.receiver_oid,
      invitation.sender_domain,
      acceptedTerms,
      invitation.invitation_id,
      senderDomainIdStr,
    );

    // Auto-upsert a contact for the sender identity when domain_id is present.
    if (senderDomainIdStr) {
      await this.contactManager.upsertFromInvitation(
        invitation.receiver_oid,
        invitation.sender_domain,
        senderDomainIdStr,
        invitation.claims,
        acceptedAt,
      );

      // Auto-create a receipt-based receptive policy so the sender can re-invite.
      await this.receptivePolicyManager.createReceiptPolicy(
        invitation.receiver_oid,
        receipt.id,
      );
    }

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
