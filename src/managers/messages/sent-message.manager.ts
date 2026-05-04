import type { SentMessage } from "../../models/messages/sent-message.model.ts";
import type {
  ListSentMessagesOptions,
  ListSentMessagesResult,
  SentMessageRepository,
} from "../../repositories/messages/sent-message.repository.ts";

export class SentMessageManager {
  constructor(private readonly sentMessages: SentMessageRepository) {}

  async store(
    data: Omit<SentMessage, "id">,
  ): Promise<SentMessage> {
    return await this.sentMessages.create(data);
  }

  async listByOid(
    oid: string,
    opts?: ListSentMessagesOptions,
  ): Promise<ListSentMessagesResult> {
    return await this.sentMessages.listByOid(oid, opts);
  }
}
