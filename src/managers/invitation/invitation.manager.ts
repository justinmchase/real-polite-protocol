import type { Invitation } from "../../models/mod.ts";
import type { InvitationRepository } from "../../repositories/mod.ts";

export class InvitationManager {
  constructor(
    private readonly invitations: InvitationRepository,
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

  async accept(
    invitationId: string,
    negotiatedTerms?: Record<string, unknown>,
  ): Promise<Invitation> {
    const invitation = await this.invitations.get(invitationId);
    if (!invitation) {
      throw new Error(`Invitation ${invitationId} not found`);
    }

    if (invitation.status !== "pending") {
      throw new Error(
        `Invitation ${invitationId} cannot be accepted: current status is "${invitation.status}"`,
      );
    }

    const updated: Invitation = {
      ...invitation,
      status: "accepted",
      accepted_at: new Date().toISOString(),
      proposed_terms: negotiatedTerms ?? invitation.proposed_terms,
    };
    return await this.invitations.set(updated);
  }

  async reject(invitationId: string): Promise<Invitation> {
    const invitation = await this.invitations.get(invitationId);
    if (!invitation) {
      throw new Error(`Invitation ${invitationId} not found`);
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
      throw new Error(`Invitation ${invitationId} not found`);
    }

    const updated: Invitation = {
      ...invitation,
      status: "cancelled",
    };
    return await this.invitations.set(updated);
  }
}
