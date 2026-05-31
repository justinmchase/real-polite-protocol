import type { MessageCategory } from "../../models/message-category.ts";
import {
  type StoredMessage,
  StoredMessageSchema,
} from "../../models/messages/stored-message.model.ts";
import type { EventService } from "../../services/events/event.service.ts";
import type { KvService } from "../../services/kv/kv.service.ts";
import { nextResumeToken } from "../../utils/pagination.ts";

const MESSAGE_PREFIX: Deno.KvKey = ["stored_messages"];
const MESSAGE_BY_OID_PREFIX: Deno.KvKey = ["stored_messages_by_oid"];
const MESSAGE_BY_MESSAGE_ID_PREFIX: Deno.KvKey = [
  "stored_messages_by_message_id",
];

export interface ListMessagesOptions {
  category?: MessageCategory;
  contactId?: string;
  remoteDomain?: string;
  receivedAfter?: Date;
  receivedBefore?: Date;
  read?: boolean;
  pageSize?: number;
  cursor?: string;
}

export interface ListMessagesResult {
  messages: StoredMessage[];
  nextCursor?: string;
}

export class MessageRepository {
  constructor(
    private readonly kv: KvService,
    private readonly events: EventService,
  ) {}

  async get(id: string): Promise<StoredMessage | undefined> {
    const entry = await this.kv.store.get<unknown>([...MESSAGE_PREFIX, id]);
    return entry.value ? StoredMessageSchema.parse(entry.value) : undefined;
  }

  async set(message: StoredMessage): Promise<StoredMessage> {
    await this.kv.store
      .atomic()
      .set([...MESSAGE_PREFIX, message.id], message)
      .set([...MESSAGE_BY_OID_PREFIX, message.oid, message.id], message.id)
      .set(
        [...MESSAGE_BY_MESSAGE_ID_PREFIX, message.oid, message.message_id],
        message.id,
      )
      .commit();
    await this.events.bumpMessage(message.oid);
    return message;
  }

  async getByMessageId(
    oid: string,
    messageId: string,
  ): Promise<StoredMessage | undefined> {
    const idEntry = await this.kv.store.get<string>([
      ...MESSAGE_BY_MESSAGE_ID_PREFIX,
      oid,
      messageId,
    ]);
    if (!idEntry.value) return undefined;
    return await this.get(idEntry.value);
  }

  async update(message: StoredMessage): Promise<StoredMessage> {
    await this.kv.store.set([...MESSAGE_PREFIX, message.id], message);
    return message;
  }

  async deleteByMessageId(oid: string, messageId: string): Promise<boolean> {
    const msg = await this.getByMessageId(oid, messageId);
    if (!msg) return false;
    await this.kv.store
      .atomic()
      .delete([...MESSAGE_PREFIX, msg.id])
      .delete([...MESSAGE_BY_OID_PREFIX, msg.oid, msg.id])
      .delete([...MESSAGE_BY_MESSAGE_ID_PREFIX, msg.oid, msg.message_id])
      .commit();
    return true;
  }

  /**
   * Cascade-delete every stored message owned by `oid` and associated with
   * `contactId`. Used when a contact is permanently deleted (spec §11.6 /
   * req:contacts-005).
   */
  async deleteByContact(oid: string, contactId: string): Promise<number> {
    const prefix = [...MESSAGE_BY_OID_PREFIX, oid];
    const iter = this.kv.store.list<string>({ prefix });
    let deleted = 0;
    for await (const entry of iter) {
      const msg = await this.get(entry.value);
      if (!msg) continue;
      if (msg.contact_id !== contactId) continue;
      await this.kv.store
        .atomic()
        .delete([...MESSAGE_PREFIX, msg.id])
        .delete([...MESSAGE_BY_OID_PREFIX, msg.oid, msg.id])
        .delete([...MESSAGE_BY_MESSAGE_ID_PREFIX, msg.oid, msg.message_id])
        .commit();
      deleted++;
    }
    return deleted;
  }

  async markRead(
    oid: string,
    messageIds: string[],
  ): Promise<
    { marked: string[]; already_read: string[]; not_found: string[] }
  > {
    const marked: string[] = [];
    const already_read: string[] = [];
    const not_found: string[] = [];

    for (const messageId of messageIds) {
      const msg = await this.getByMessageId(oid, messageId);
      if (!msg) {
        not_found.push(messageId);
        continue;
      }
      if (msg.read) {
        already_read.push(messageId);
        continue;
      }
      const updated: StoredMessage = {
        ...msg,
        read: true,
        read_at: new Date(),
      };
      await this.update(updated);
      marked.push(messageId);
    }

    return { marked, already_read, not_found };
  }

  async listByOid(
    oid: string,
    opts: ListMessagesOptions = {},
  ): Promise<ListMessagesResult> {
    const {
      category,
      contactId,
      remoteDomain,
      receivedAfter,
      receivedBefore,
      read,
      pageSize = 50,
      cursor,
    } = opts;

    const prefix = [...MESSAGE_BY_OID_PREFIX, oid];
    const listOpts: Deno.KvListOptions = { limit: pageSize, reverse: true };
    if (cursor) listOpts.cursor = cursor;

    const iter = this.kv.store.list<string>({ prefix }, listOpts);
    const messages: StoredMessage[] = [];

    for await (const entry of iter) {
      const msg = await this.get(entry.value);
      if (!msg) continue;
      if (category !== undefined && msg.category !== category) continue;
      if (contactId !== undefined && msg.contact_id !== contactId) continue;
      if (
        remoteDomain !== undefined &&
        msg.remote_domain.toLowerCase() !== remoteDomain.toLowerCase()
      ) continue;
      if (receivedAfter !== undefined && msg.received_at <= receivedAfter) {
        continue;
      }
      if (receivedBefore !== undefined && msg.received_at >= receivedBefore) {
        continue;
      }
      if (read !== undefined && msg.read !== read) continue;
      messages.push(msg);
    }

    return { messages, nextCursor: nextResumeToken(iter.cursor) };
  }
}
