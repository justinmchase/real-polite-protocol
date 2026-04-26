import { encodeHex } from "@std/encoding/hex";
import { generate as generateUUIDv7 } from "@std/uuid/v7";
import type {
  Receipt,
  ReceiptTerms,
  RevocationReason,
} from "../../models/mod.ts";
import type { ReceiptRepository } from "../../repositories/mod.ts";
import type {
  ListReceiptsOptions,
  ListReceiptsResult,
} from "../../repositories/receipt/receipt.repository.ts";
import {
  ReceiptAlreadyRevokedError,
  ReceiptNotFoundError,
  ReceiptNotOwnedError,
} from "../../tools/receipt/receipt.error.ts";
import type { ReceptivePolicyManager } from "../receptive-policy/receptive-policy.manager.ts";

export class ReceiptManager {
  constructor(
    private readonly receipts: ReceiptRepository,
    private readonly receptivePolicies: ReceptivePolicyManager,
  ) {}

  /**
   * Issue a new receipt to a sender domain on behalf of a receiver account.
   * Terms are extracted from the negotiated invitation terms.
   */
  async issue(
    oid: string,
    senderDomain: string,
    terms: ReceiptTerms,
    invitationId?: string,
    senderDomainId?: string,
  ): Promise<Receipt> {
    const secretBytes = new Uint8Array(32);
    crypto.getRandomValues(secretBytes);
    const secret = encodeHex(secretBytes);

    const receipt: Receipt = {
      id: generateUUIDv7(),
      secret,
      oid,
      sender_domain: senderDomain,
      ...(senderDomainId !== undefined && { sender_domain_id: senderDomainId }),
      category: terms.category,
      max_content_rating: terms.max_content_rating ?? "G",
      usage_policy: terms.usage_policy ?? "any-time",
      status: "active",
      ...(invitationId !== undefined && { invitation_id: invitationId }),
      issued_at: new Date(),
    };

    return await this.receipts.set(receipt);
  }

  /**
   * Revoke all active receipts for the given `(oid, senderDomain, senderDomainId)` composite
   * with reason SUPERSEDED. Called before issuing a new receipt for the same identity.
   */
  async revokeSuperseded(
    oid: string,
    senderDomain: string,
    senderDomainId: string,
    revokedAt: Date,
  ): Promise<void> {
    const active = await this.receipts.listActiveBySender(
      oid,
      senderDomain,
      senderDomainId,
    );
    for (const receipt of active) {
      const updated: Receipt = {
        ...receipt,
        status: "revoked",
        revoked_at: revokedAt,
        revocation_reason: "SUPERSEDED",
      };
      await this.receipts.set(updated, "active");
      // Delete any receipt-based receptive policies for the superseded receipt.
      await this.receptivePolicies.deactivateReceiptPolicies(receipt.id);
    }
  }

  async get(id: string): Promise<Receipt | undefined> {
    return await this.receipts.get(id);
  }

  async listIssuedByOid(
    oid: string,
    opts?: ListReceiptsOptions,
  ): Promise<ListReceiptsResult> {
    return await this.receipts.listByOid(oid, opts);
  }

  /**
   * Revoke an issued receipt. Only the issuing account may revoke it.
   * Revocation is immediate; subsequent submit requests will be rejected.
   */
  async revoke(
    oid: string,
    receiptId: string,
    reason: RevocationReason,
    detail?: string,
  ): Promise<Receipt> {
    const receipt = await this.receipts.get(receiptId);
    if (!receipt) {
      throw new ReceiptNotFoundError(receiptId);
    }
    if (receipt.oid !== oid) {
      throw new ReceiptNotOwnedError(receiptId);
    }
    if (receipt.status !== "active") {
      throw new ReceiptAlreadyRevokedError(receiptId);
    }

    const updated: Receipt = {
      ...receipt,
      status: "revoked",
      revoked_at: new Date(),
      revocation_reason: reason,
      ...(detail !== undefined && { revocation_detail: detail }),
    };
    await this.receipts.set(updated, "active");
    // Delete any receipt-based receptive policies for the revoked receipt.
    await this.receptivePolicies.deactivateReceiptPolicies(receiptId);
    return await this.receipts.get(receiptId) as Receipt;
  }
}
