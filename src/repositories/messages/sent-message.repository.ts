import { generate as generateUUIDv7 } from "@std/uuid/v7";
import type { MessageCategory } from "../../models/message-category.ts";
import {
  type SentMessage,
  SentMessageSchema,
} from "../../models/messages/sent-message.model.ts";
import type { KvService } from "../../services/kv/kv.service.ts";
import { nextResumeToken } from "../../utils/pagination.ts";

const SENT_PREFIX: Deno.KvKey = ["sent_messages"];
const SENT_BY_OID_PREFIX: Deno.KvKey = ["sent_messages_by_oid"];

export interface ListSentMessagesOptions {
  category?: MessageCategory;
  contactId?: string;
  remoteDomain?: string;
  sentAfter?: Date;
  sentBefore?: Date;
  status?: "delivered" | "failed";
  pageSize?: number;
  cursor?: string;
}

export interface ListSentMessagesResult {
  messages: SentMessage[];
  nextCursor?: string;
}

export class SentMessageRepository {
  constructor(private readonly kv: KvService) {}

  async set(message: SentMessage): Promise<SentMessage> {
    await this.kv.store
      .atomic()
      .set([...SENT_PREFIX, message.id], message)
      .set([...SENT_BY_OID_PREFIX, message.oid, message.id], message.id)
      .commit();
    return message;
  }

  async create(data: Omit<SentMessage, "id">): Promise<SentMessage> {
    const message: SentMessage = { id: generateUUIDv7(), ...data };
    return await this.set(message);
  }

  private async get(id: string): Promise<SentMessage | undefined> {
    const entry = await this.kv.store.get<unknown>([...SENT_PREFIX, id]);
    return entry.value ? SentMessageSchema.parse(entry.value) : undefined;
  }

  async listByOid(
    oid: string,
    opts: ListSentMessagesOptions = {},
  ): Promise<ListSentMessagesResult> {
    const {
      category,
      contactId,
      remoteDomain,
      sentAfter,
      sentBefore,
      status,
      pageSize = 50,
      cursor,
    } = opts;

    const prefix = [...SENT_BY_OID_PREFIX, oid];
    const listOpts: Deno.KvListOptions = { limit: pageSize, reverse: true };
    if (cursor) listOpts.cursor = cursor;

    const iter = this.kv.store.list<string>({ prefix }, listOpts);
    const messages: SentMessage[] = [];

    for await (const entry of iter) {
      const msg = await this.get(entry.value);
      if (!msg) continue;
      if (category !== undefined && msg.category !== category) continue;
      if (contactId !== undefined && msg.contact_id !== contactId) continue;
      if (
        remoteDomain !== undefined &&
        msg.remote_domain.toLowerCase() !== remoteDomain.toLowerCase()
      ) continue;
      if (sentAfter !== undefined && msg.sent_at <= sentAfter) continue;
      if (sentBefore !== undefined && msg.sent_at >= sentBefore) continue;
      if (status !== undefined && msg.status !== status) continue;
      messages.push(msg);
    }

    return { messages, nextCursor: nextResumeToken(iter.cursor) };
  }
}
