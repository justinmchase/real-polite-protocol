import type { Receipt, RevocationReason } from "../../models/mod.ts";
import type { ReceiptRepository } from "../../repositories/mod.ts";
import {
  ReceiptAlreadyRevokedError,
  ReceiptNotFoundError,
  ReceiptNotOwnedError,
} from "../../tools/receipt/receipt.error.ts";

export class ReceiptManager {
  constructor(private readonly receipts: ReceiptRepository) {}

  /**
   * Issue a new receipt to a sender domain on behalf of a receiver account.
   * Terms are extracted from the negotiated invitation terms.
   */
  async issue(
    oid: string,
    senderDomain: string,
    terms: Record<string, unknown>,
    invitationId?: string,
  ): Promise<Receipt> {
    // Extract category from proposed_terms.categories[0] or proposed_terms.category
    const category =
      (Array.isArray(terms.categories) && typeof terms.categories[0] === "string")
        ? (terms.categories as string[])[0]
        : typeof terms.category === "string"
        ? terms.category
        : "message";

    const receipt: Receipt = {
      id: crypto.randomUUID(),
      secret: crypto.randomUUID(),
      oid,
      sender_domain: senderDomain,
      category,
      max_content_rating:
        typeof terms.max_content_rating === "string" ? terms.max_content_rating : "G",
      usage_policy:
        terms.usage_policy === "one-time" || terms.usage_policy === "multiple-time"
          ? terms.usage_policy
          : "any-time",
      status: "active",
      ...(invitationId !== undefined && { invitation_id: invitationId }),
      issued_at: new Date().toISOString(),
    };

    return await this.receipts.set(receipt);
  }

  async get(id: string): Promise<Receipt | undefined> {
    return await this.receipts.get(id);
  }

  async listIssuedByOid(oid: string): Promise<Receipt[]> {
    return await this.receipts.listByOid(oid);
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
      revoked_at: new Date().toISOString(),
      revocation_reason: reason,
      ...(detail !== undefined && { revocation_detail: detail }),
    };
    return await this.receipts.set(updated);
  }
}
