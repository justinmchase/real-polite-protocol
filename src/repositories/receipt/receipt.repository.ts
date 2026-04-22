import type { Receipt } from "../../models/mod.ts";
import type { KvService } from "../../services/kv/kv.service.ts";

const RECEIPT_PREFIX: Deno.KvKey = ["receipts"];
const RECEIPT_BY_OID_PREFIX: Deno.KvKey = ["receipts_by_oid"];

export class ReceiptRepository {
  constructor(private readonly kv: KvService) {}

  async get(id: string): Promise<Receipt | undefined> {
    const entry = await this.kv.store.get<Receipt>([...RECEIPT_PREFIX, id]);
    return entry.value ?? undefined;
  }

  async set(receipt: Receipt): Promise<Receipt> {
    await this.kv.store
      .atomic()
      .set([...RECEIPT_PREFIX, receipt.id], receipt)
      .set([...RECEIPT_BY_OID_PREFIX, receipt.oid, receipt.id], receipt.id)
      .commit();
    return receipt;
  }

  async listByOid(oid: string): Promise<Receipt[]> {
    const results: Receipt[] = [];
    for await (
      const entry of this.kv.store.list<string>({
        prefix: [...RECEIPT_BY_OID_PREFIX, oid],
      })
    ) {
      const receiptId = entry.value;
      const receipt = await this.get(receiptId);
      if (receipt) {
        results.push(receipt);
      }
    }
    return results;
  }
}
