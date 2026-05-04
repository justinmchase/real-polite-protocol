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
  InvitationNotCancellableError,
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
    expiresAt: Date | undefined,
    messageId?: string,
    delivery?: { domain: string; token: string },
  ): Promise<Invitation> {
    const invitation: Invitation = {
      invitation_id: invitationId,
      receiver_oid: receiverOid,
      sender_domain: senderDomain,
      status: "pending",
      proposed_terms: proposedTerms,
      ...(claims !== undefined && { claims }),
      ...(expiresAt !== undefined && { expires_at: expiresAt }),
      created_at: new Date(),
      message_id: messageId,
      ...(delivery !== undefined && { delivery }),
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
   * Create a sender-side invitation record for a cross-domain outbound
   * invitation. This allows the receipt callback handler to find the invitation
   * when the remote server POSTs back, verify the delivery HMAC, and store the
   * issued receipt under the sender's local OID.
   *
   * The record uses `receiver_oid = senderOid` (the local sender) so that
   * `ReceiptCallbackHandler` can retrieve the correct local oid for receipt
   * storage. The separate `sender_oid` field is also set explicitly.
   */
  async createSenderRecord(
    invitationId: string,
    senderOid: string,
    senderDomain: string,
    receiverDomain: string,
    proposedTerms: ReceiptTerms,
    deliveryToken: string,
    createdAt: Date,
  ): Promise<Invitation> {
    const invitation: Invitation = {
      invitation_id: invitationId,
      receiver_oid: senderOid, // sender's local oid stored in receiver_oid by convention
      sender_oid: senderOid,
      receiver_domain: receiverDomain,
      sender_domain: senderDomain,
      status: "pending",
      proposed_terms: proposedTerms,
      delivery: { domain: senderDomain, token: deliveryToken },
      created_at: createdAt,
    };
    return await this.invitations.set(invitation);
  }

  /** Returns both the updated invitation and the newly issued receipt.
   */
  async accept(
    invitationId: string,
    negotiatedTerms?: ReceiptTerms,
    reason?: string,
  ): Promise<{ invitation: Invitation; receipt: Receipt }> {
    const invitation = await this.invitations.get(invitationId);
    if (!invitation) {
      throw new InvitationNotFoundError(invitationId);
    }

    if (invitation.status !== "pending") {
      throw new InvitationNotPendingError(invitationId, invitation.status);
    }

    const acceptedTerms = negotiatedTerms ?? invitation.proposed_terms;
    const acceptedAt = new Date();

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

    // Persist a summary of the issued receipt on the invitation so the
    // original sender can observe acceptance + terms via review_invitation.
    // Section 9.7.3 step 5 ("store the receipt locally"): the secret is
    // included so the sender's server can verify HMAC signatures on inbound
    // messages from the acceptor. For same-domain acceptance the receipt
    // already exists in the local receipts table; this summary additionally
    // surfaces it on the sender's view of the invitation.
    const updated: Invitation = {
      ...invitation,
      status: "accepted",
      accepted_at: acceptedAt,
      proposed_terms: acceptedTerms,
      receipt: {
        id: receipt.id,
        secret: receipt.secret,
        category: receipt.category,
        max_content_rating: receipt.max_content_rating,
        usage_policy: receipt.usage_policy,
        issued_at: receipt.issued_at,
      },
      ...(reason !== undefined && { decision_reason: reason }),
    };
    const savedInvitation = await this.invitations.set(updated);

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

  async reject(invitationId: string, reason?: string): Promise<Invitation> {
    const invitation = await this.invitations.get(invitationId);
    if (!invitation) {
      throw new InvitationNotFoundError(invitationId);
    }

    const updated: Invitation = {
      ...invitation,
      status: "rejected",
      ...(reason !== undefined && { decision_reason: reason }),
    };
    return await this.invitations.set(updated);
  }

  async cancel(
    invitationId: string,
    senderDomainId: string,
  ): Promise<Invitation> {
    const invitation = await this.invitations.get(invitationId);

    // Return not-found for missing OR caller-is-not-sender (avoids leaking existence).
    const invitationDomainId = invitation?.claims?.immutable?.["domain_id"];
    if (!invitation || invitationDomainId !== senderDomainId) {
      throw new InvitationNotFoundError(invitationId);
    }

    const cancellableStates = ["pending", "accepted"];
    if (!cancellableStates.includes(invitation.status)) {
      throw new InvitationNotCancellableError(invitationId, invitation.status);
    }

    // Revoke all receipts derived from this invitation.
    if (
      invitation.status === "accepted" &&
      typeof invitationDomainId === "string"
    ) {
      await this.receiptManager.revokeSuperseded(
        invitation.receiver_oid,
        invitation.sender_domain,
        invitationDomainId,
        new Date(),
      );
    }

    const updated: Invitation = {
      ...invitation,
      status: "cancelled",
    };
    return await this.invitations.set(updated);
  }

  async markUndelivered(invitationId: string): Promise<Invitation> {
    const invitation = await this.invitations.get(invitationId);
    if (!invitation) {
      throw new InvitationNotFoundError(invitationId);
    }

    const updated: Invitation = {
      ...invitation,
      status: "undelivered",
    };
    return await this.invitations.set(updated);
  }

  /**
   * Deliver an invitation in-process, bypassing the HTTP envelope endpoint.
   *
   * Used when sender and receiver share the same domain so we avoid Deno
   * Deploy's self-loop detection (508). Replicates the receiver-OID resolution
   * logic of InvitationMessageHandler without a network round-trip.
   */
  async deliverLocally(
    invitationId: string,
    messageId: string,
    senderDomain: string,
    claims: InvitationClaims | undefined,
    receptivePolicyId: string | undefined,
    shortcode: string | undefined,
    receiptId: string | undefined,
    proposedTerms: ReceiptTerms,
    expiresAt: Date | undefined,
    delivery: { domain: string; token: string },
  ): Promise<Invitation> {
    if (!receiptId && !receptivePolicyId && !shortcode) {
      throw new Error(
        "deliverLocally requires exactly one of: receiptId, receptivePolicyId, or shortcode.",
      );
    }

    let receiverOid: string;

    if (receiptId) {
      const receipt = await this.receiptManager.get(receiptId);
      if (!receipt || receipt.status !== "active") {
        throw new InvitationNotFoundError(receiptId);
      }
      const receiptPolicy = await this.receptivePolicyManager
        .findActiveReceiptPolicy(receipt.oid, receiptId);
      if (!receiptPolicy) {
        throw new InvitationNotFoundError(receiptId);
      }
      receiverOid = receipt.oid;
    } else {
      let policyId = receptivePolicyId;
      if (!policyId && shortcode) {
        const byShortcode = await this.receptivePolicyManager.getByShortcode(
          shortcode,
        );
        if (!byShortcode) {
          throw new InvitationNotFoundError(shortcode);
        }
        policyId = byShortcode.policy_id;
      }
      const policy = await this.receptivePolicyManager.getById(policyId!);
      if (!policy) {
        throw new InvitationNotFoundError(policyId!);
      }
      if (policy.receptive_until && policy.receptive_until < new Date()) {
        throw new InvitationNotFoundError(policyId!);
      }
      if (policy.mode === "closed") {
        throw new InvitationNotFoundError(policyId!);
      }
      if (policy.mode === "contact") {
        const senderDomainId = claims?.immutable?.["domain_id"];
        const allowed = typeof senderDomainId === "string" &&
          policy.contacts?.some(
            (c) =>
              c.domain_id === senderDomainId &&
              c.domain.toLowerCase() === senderDomain.toLowerCase(),
          );
        if (!allowed) {
          throw new InvitationNotFoundError(policyId!);
        }
      }
      receiverOid = policy.oid;
    }

    return await this.createInvitation(
      invitationId,
      receiverOid,
      senderDomain,
      proposedTerms,
      claims,
      expiresAt,
      messageId,
      delivery,
    );
  }
}
