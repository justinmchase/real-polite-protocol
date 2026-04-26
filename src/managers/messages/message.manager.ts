import { generate as generateUUIDv7 } from "@std/uuid/v7";
import type { MessageEnvelope } from "../../controllers/submit/message-handler.ts";
import type { MessageCategory } from "../../models/message-category.ts";
import type { StoredMessage } from "../../models/messages/stored-message.model.ts";
import type {
  ListMessagesOptions,
  ListMessagesResult,
  MessageRepository,
} from "../../repositories/messages/message.repository.ts";

export class MessageManager {
  constructor(private readonly messages: MessageRepository) {}

  async store(
    oid: string,
    receiptId: string,
    category: MessageCategory,
    envelope: MessageEnvelope,
  ): Promise<StoredMessage> {
    const msg: StoredMessage = {
      id: generateUUIDv7(),
      oid,
      receipt_id: receiptId,
      message_id: envelope.message_id,
      sender_domain: envelope.sender_domain,
      sender_domain_id: envelope.sender_domain_id,
      category,
      sent_at: envelope.sent_at,
      received_at: new Date(),
      read: false,
      message: {
        content_rating: envelope.message.content_rating,
        subject: envelope.message.subject,
        body: {
          content_type: envelope.message.body.content_type,
          content: envelope.message.body.content,
        },
      },
    };
    return await this.messages.set(msg);
  }

  async listByOid(
    oid: string,
    opts?: ListMessagesOptions,
  ): Promise<ListMessagesResult> {
    return await this.messages.listByOid(oid, opts);
  }

  async getByMessageId(
    oid: string,
    messageId: string,
  ): Promise<StoredMessage | undefined> {
    return await this.messages.getByMessageId(oid, messageId);
  }

  async markRead(
    oid: string,
    messageIds: string[],
  ): Promise<
    { marked: string[]; already_read: string[]; not_found: string[] }
  > {
    return await this.messages.markRead(oid, messageIds);
  }

  async deleteByMessageId(oid: string, messageId: string): Promise<boolean> {
    return await this.messages.deleteByMessageId(oid, messageId);
  }
}
