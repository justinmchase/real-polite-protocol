import { generate as generateUUIDv7 } from "@std/uuid/v7";
import type { ContentRating } from "../../models/content-rating.ts";
import type { MessageCategory } from "../../models/message-category.ts";
import type {
  MessageMetadata,
  StoredMessage,
} from "../../models/messages/stored-message.model.ts";
import type {
  ListMessagesOptions,
  ListMessagesResult,
  MessageRepository,
} from "../../repositories/messages/message.repository.ts";

export interface StoreInboundMessageInput {
  oid: string;
  contactId: string;
  remoteDomain: string;
  messageId: string;
  category: MessageCategory;
  contentRating: ContentRating;
  sentAt: Date;
  receivedAt: Date;
  subject: string;
  body: { content_type: string; content: string };
  metadata?: MessageMetadata;
}

export class MessageManager {
  constructor(private readonly messages: MessageRepository) {}

  async store(input: StoreInboundMessageInput): Promise<StoredMessage> {
    const msg: StoredMessage = {
      id: generateUUIDv7(),
      oid: input.oid,
      contact_id: input.contactId,
      message_id: input.messageId,
      remote_domain: input.remoteDomain,
      category: input.category,
      content_rating: input.contentRating,
      sent_at: input.sentAt,
      received_at: input.receivedAt,
      read: false,
      message: { subject: input.subject, body: input.body },
      ...(input.metadata !== undefined && { metadata: input.metadata }),
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

  async deleteByContact(oid: string, contactId: string): Promise<number> {
    return await this.messages.deleteByContact(oid, contactId);
  }
}
