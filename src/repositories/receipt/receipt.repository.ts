import type { Receipt, ReceiptStatus } from "../../models/mod.ts";
import type { KvService } from "../../services/kv/kv.service.ts";
import { nextResumeToken } from "../../utils/pagination.ts";

const RECEIPT_PREFIX: Deno.KvKey = ["receipts"];
/** Secondary index: list all receipts for a given OID. */
const RECEIPT_BY_OID_PREFIX: Deno.KvKey = ["receipts_by_oid"];
/** Secondary index: filter by OID + status (e.g. list only active receipts). */
const RECEIPT_BY_OID_STATUS_PREFIX: Deno.KvKey = ["receipts_by_oid_status"];
/** Secondary index: filter by OID + sender_domain. */
const RECEIPT_BY_OID_DOMAIN_PREFIX: Deno.KvKey = ["receipts_by_oid_domain"];
/** Secondary index: filter by OID + sender_domain + sender_domain_id (composite identity). */
const RECEIPT_BY_OID_SENDER_PREFIX: Deno.KvKey = [
  "receipts_by_oid_sender",
];

export interface ListReceiptsOptions {
  status?: ReceiptStatus;
  senderDomain?: string;
  pageSize?: number;
  /** Opaque resume token from a previous list call. */
  cursor?: string;
}

export interface ListReceiptsResult {
  receipts: Receipt[];
  /** Present when more pages are available; pass as `cursor` in the next call. */
  nextCursor?: string;
}

export class ReceiptRepository {
  constructor(private readonly kv: KvService) {}

  async get(id: string): Promise<Receipt | undefined> {
    const entry = await this.kv.store.get<Receipt>([...RECEIPT_PREFIX, id]);
    return entry.value ?? undefined;
  }

  /**
   * Write a receipt to the primary store and all secondary indexes.
   *
   * @param receipt       The receipt to persist.
   * @param previousStatus  If this is an update that changes status (e.g. revocation),
   *                        supply the old status so the stale index entries are removed.
   */
  async set(
    receipt: Receipt,
    previousStatus?: ReceiptStatus,
  ): Promise<Receipt> {
    let op = this.kv.store
      .atomic()
      .set([...RECEIPT_PREFIX, receipt.id], receipt)
      .set([...RECEIPT_BY_OID_PREFIX, receipt.oid, receipt.id], receipt.id)
      .set(
        [
          ...RECEIPT_BY_OID_STATUS_PREFIX,
          receipt.oid,
          receipt.status,
          receipt.id,
        ],
        receipt.id,
      )
      .set(
        [
          ...RECEIPT_BY_OID_DOMAIN_PREFIX,
          receipt.oid,
          receipt.sender_domain,
          receipt.id,
        ],
        receipt.id,
      );

    // Index by composite sender identity (sender_domain + domain_id UUID) when both present.
    if (receipt.sender_domain_id) {
      op = op.set(
        [
          ...RECEIPT_BY_OID_SENDER_PREFIX,
          receipt.oid,
          receipt.sender_domain,
          receipt.sender_domain_id,
          receipt.id,
        ],
        receipt.id,
      );
    }

    // Remove stale status index entries when status transitions (e.g. active → revoked).
    if (previousStatus !== undefined && previousStatus !== receipt.status) {
      op = op.delete([
        ...RECEIPT_BY_OID_STATUS_PREFIX,
        receipt.oid,
        previousStatus,
        receipt.id,
      ]);
    }

    await op.commit();
    return receipt;
  }

  /**
   * List receipts for an OID using the appropriate secondary index.
   *
   * - Filtering by `status` uses the OID+status index.
   * - Filtering by `senderDomain` uses the OID+domain index.
   * - No filter uses the base OID index.
   *
   * Pagination is cursor-based via Deno KV's built-in `cursor` / `limit` support.
   */
  async listByOid(
    oid: string,
    opts: ListReceiptsOptions = {},
  ): Promise<ListReceiptsResult> {
    const { status, senderDomain, pageSize = 50, cursor } = opts;

    const prefix = status
      ? [...RECEIPT_BY_OID_STATUS_PREFIX, oid, status]
      : senderDomain
      ? [...RECEIPT_BY_OID_DOMAIN_PREFIX, oid, senderDomain]
      : [...RECEIPT_BY_OID_PREFIX, oid];

    const listOpts: Deno.KvListOptions = { limit: pageSize };
    if (cursor) listOpts.cursor = cursor;

    const iter = this.kv.store.list<string>({ prefix }, listOpts);
    const receipts: Receipt[] = [];

    for await (const entry of iter) {
      const receipt = await this.get(entry.value);
      if (receipt) receipts.push(receipt);
    }

    return {
      receipts,
      nextCursor: nextResumeToken(iter.cursor),
    };
  }

  /**
   * Return all active receipts for the given `(oid, senderDomain, senderDomainId)` composite.
   * Used by the superseding logic before issuing a new receipt for the same identity.
   */
  async listActiveBySender(
    oid: string,
    senderDomain: string,
    senderDomainId: string,
  ): Promise<Receipt[]> {
    const prefix = [
      ...RECEIPT_BY_OID_SENDER_PREFIX,
      oid,
      senderDomain,
      senderDomainId,
    ];
    const iter = this.kv.store.list<string>({ prefix });
    const receipts: Receipt[] = [];
    for await (const entry of iter) {
      const receipt = await this.get(entry.value);
      if (receipt && receipt.status === "active") {
        receipts.push(receipt);
      }
    }
    return receipts;
  }
}
