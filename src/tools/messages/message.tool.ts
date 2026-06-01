import { generate as generateUUIDv7 } from "@std/uuid/v7";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthInfo } from "../../context.ts";
import type {
  ContactManager,
  MessageManager,
  SentMessageManager,
} from "../../managers/mod.ts";
import { flatMerge } from "../../managers/contacts/contact.manager.ts";
import { CONTENT_RATINGS, MESSAGE_CATEGORIES } from "../../models/mod.ts";
import { MessageMetadataSchema } from "../../models/messages/stored-message.model.ts";
import type { ConfigService } from "../../services/config/config.service.ts";
import { toolResult, withToolErrorHandling } from "../tool-result.ts";
import { inputDate, outputDate } from "../date-schema.ts";
import { dispatchMessageEnvelope } from "../envelope-dispatch.ts";
import { EnvelopeTooLargeError } from "../../controllers/submit/submit.error.ts";
import {
  CategoryNotPermittedError,
  ContactNotReadyError,
  ContentRatingNotPermittedError,
  InvalidBodyError,
  InvalidContentTypeError,
  MessageDeliveryError,
  MessageNotFoundError,
} from "./message.error.ts";

const CategorySchema = z.enum(MESSAGE_CATEGORIES);
const ContentRatingSchema = z.enum(CONTENT_RATINGS);

const PERMITTED_CONTENT_TYPES = ["text/markdown", "application/json"] as const;
const MAX_BODY_BYTES = 262144; // 256 KB (spec §8.1.1)

const ClaimValueOutputSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])),
]);

const ContactFieldRecordSchema = z.object({
  value: ClaimValueOutputSchema,
  source: z.enum([
    "sender_verified",
    "domain_admin",
    "sender_custom",
    "owner_note",
  ]),
  recorded_at: outputDate(),
});

const ListMessagesInputSchema = {
  category: CategorySchema.optional().describe("Filter by message category"),
  contact_id: z.string().optional().describe("Filter by contact ID"),
  remote_domain: z.string().optional().describe(
    "Filter by remote domain (case-insensitive)",
  ),
  received_after: inputDate().optional(),
  received_before: inputDate().optional(),
  read: z.boolean().optional(),
  page_size: z.number().int().min(1).max(200).optional(),
  resume_token: z.string().optional(),
};

const StoredMessageOutputSchema = z.object({
  id: z.string(),
  contact_id: z.string(),
  message_id: z.string(),
  remote_domain: z.string(),
  category: CategorySchema,
  content_rating: ContentRatingSchema,
  sent_at: outputDate(),
  received_at: outputDate(),
  read: z.boolean(),
  read_at: outputDate().optional(),
  message: z.object({
    subject: z.string(),
    body: z.object({
      content_type: z.string(),
      content: z.string(),
    }),
  }),
  metadata: MessageMetadataSchema.optional(),
  sender_fields: z.record(z.string(), ContactFieldRecordSchema).describe(
    "Flat-merged contact fields for the message sender (current values, all sources).",
  ),
});

const ListMessagesOutputSchema = {
  messages: z.array(StoredMessageOutputSchema),
  page_size: z.number().int(),
  next_resume_token: z.string().optional(),
};

const GetMessageInputSchema = {
  message_id: z.string().describe("Wire message_id"),
};

const GetMessageOutputSchema = { ...StoredMessageOutputSchema.shape };

const MarkReadInputSchema = {
  message_ids: z.array(z.string()).min(1).describe("Wire message_ids"),
};

const MarkReadOutputSchema = {
  marked: z.array(z.string()),
  already_read: z.array(z.string()),
  not_found: z.array(z.string()),
};

const DeleteMessageInputSchema = {
  message_id: z.string(),
};

const DeleteMessageOutputSchema = {
  message_id: z.string(),
  deleted: z.literal(true),
};

const SendMessageInputSchema = {
  contact_id: z.string().describe(
    "ID of the local contact to send to. The contact's negotiated remote_terms must permit category and content_rating.",
  ),
  category: CategorySchema.describe("Message category"),
  content_rating: ContentRatingSchema.describe(
    "Content rating of this message",
  ),
  body: z.object({
    content_type: z.enum(PERMITTED_CONTENT_TYPES),
    content: z.string(),
  }),
  subject: z.string().optional(),
  sender_display_name: z.string().max(256).optional(),
  metadata: MessageMetadataSchema.optional(),
};

const SendMessageOutputSchema = {
  message_id: z.string(),
  sent_at: outputDate(),
  accepted: z.boolean(),
};

const SentMessageOutputSchema = z.object({
  id: z.string(),
  contact_id: z.string(),
  message_id: z.string(),
  remote_domain: z.string(),
  category: CategorySchema,
  content_rating: ContentRatingSchema,
  sent_at: outputDate(),
  subject: z.string().optional(),
  body: z.object({
    content_type: z.string(),
    content: z.string(),
  }),
  metadata: MessageMetadataSchema.optional(),
  status: z.enum(["delivered", "failed"]),
});

const ListSentMessagesInputSchema = {
  category: CategorySchema.optional(),
  contact_id: z.string().optional(),
  remote_domain: z.string().optional(),
  sent_after: inputDate().optional(),
  sent_before: inputDate().optional(),
  status: z.enum(["delivered", "failed"]).optional(),
  page_size: z.number().int().min(1).max(200).optional(),
  resume_token: z.string().optional(),
};

const ListSentMessagesOutputSchema = {
  messages: z.array(SentMessageOutputSchema),
  page_size: z.number().int(),
  next_resume_token: z.string().optional(),
};

type ListMessagesArgs = z.infer<z.ZodObject<typeof ListMessagesInputSchema>>;
type GetMessageArgs = z.infer<z.ZodObject<typeof GetMessageInputSchema>>;
type MarkReadArgs = z.infer<z.ZodObject<typeof MarkReadInputSchema>>;
type DeleteMessageArgs = z.infer<z.ZodObject<typeof DeleteMessageInputSchema>>;
type SendMessageArgs = z.infer<z.ZodObject<typeof SendMessageInputSchema>>;
type ListSentMessagesArgs = z.infer<
  z.ZodObject<typeof ListSentMessagesInputSchema>
>;

export class MessageTool {
  constructor(
    private readonly messageManager: MessageManager,
    private readonly sentMessageManager: SentMessageManager,
    private readonly contactManager: ContactManager,
    private readonly config: ConfigService,
  ) {}

  private async senderFields(
    oid: string,
    contactId: string,
  ): Promise<Record<string, unknown>> {
    const contact = await this.contactManager.tryGet(oid, contactId);
    if (!contact) return {};
    return flatMerge(contact.fields) as unknown as Record<string, unknown>;
  }

  register(server: McpServer, auth: AuthInfo): void {
    server.registerTool(
      "send_message",
      {
        description:
          "Send a `message` envelope to a contact. The local domain HMAC-signs the request with " +
          "the contact's remote_credential (spec §11.3 / §11.5).",
        inputSchema: SendMessageInputSchema,
        outputSchema: SendMessageOutputSchema,
      },
      withToolErrorHandling(async (params: SendMessageArgs) => {
        const contact = await this.contactManager.get(
          auth.oid,
          params.contact_id,
        );
        if (contact.blocked) throw new ContactNotReadyError(contact.id);

        if (!contact.remote_terms.categories.includes(params.category)) {
          throw new CategoryNotPermittedError(params.category);
        }
        const ratingOrder = CONTENT_RATINGS as readonly string[];
        if (
          ratingOrder.indexOf(params.content_rating) >
            ratingOrder.indexOf(contact.remote_terms.max_content_rating)
        ) {
          throw new ContentRatingNotPermittedError(
            params.content_rating,
            contact.remote_terms.max_content_rating,
          );
        }

        if (
          !PERMITTED_CONTENT_TYPES.includes(
            params.body
              .content_type as (typeof PERMITTED_CONTENT_TYPES)[number],
          )
        ) {
          throw new InvalidContentTypeError(params.body.content_type);
        }
        if (params.body.content_type === "application/json") {
          try {
            JSON.parse(params.body.content);
          } catch {
            throw new InvalidBodyError("body is not syntactically valid JSON");
          }
        }

        const messageId = generateUUIDv7();
        const sentAt = new Date();
        const envelope: Record<string, unknown> = {
          message_id: messageId,
          sender_domain: this.config.domain,
          category: params.category,
          content_rating: params.content_rating,
          sent_at: sentAt,
          subject: params.subject ?? "",
          body: params.body,
          ...(params.sender_display_name !== undefined &&
            { sender_display_name: params.sender_display_name }),
          ...(params.metadata !== undefined && { metadata: params.metadata }),
        };

        const bodyJson = JSON.stringify(envelope);
        const bodyBytes = new TextEncoder().encode(bodyJson);
        if (bodyBytes.byteLength > MAX_BODY_BYTES) {
          throw new EnvelopeTooLargeError(bodyBytes.byteLength, MAX_BODY_BYTES);
        }

        const result = await dispatchMessageEnvelope(
          contact.remote_domain,
          envelope,
          contact.remote_credential,
        );

        const status: "delivered" | "failed" = result.ok
          ? "delivered"
          : "failed";

        await this.sentMessageManager.store({
          oid: auth.oid,
          contact_id: contact.id,
          message_id: messageId,
          remote_domain: contact.remote_domain,
          category: params.category,
          content_rating: params.content_rating,
          sent_at: sentAt,
          ...(params.subject !== undefined && { subject: params.subject }),
          body: params.body,
          ...(params.metadata !== undefined && { metadata: params.metadata }),
          status,
        });

        if (!result.ok) {
          throw new MessageDeliveryError(
            contact.remote_domain,
            result.status,
            result.receiverCode,
          );
        }

        return toolResult({
          message_id: messageId,
          sent_at: sentAt,
          accepted: true,
        });
      }),
    );

    server.registerTool(
      "list_messages",
      {
        description:
          "List messages received by the authenticated account, ordered by received_at descending.",
        inputSchema: ListMessagesInputSchema,
        outputSchema: ListMessagesOutputSchema,
      },
      withToolErrorHandling(async (params: ListMessagesArgs) => {
        const { normalizePageSize, normalizeResumeToken } = await import(
          "../../utils/pagination.ts"
        );
        const pageSize = normalizePageSize(params.page_size);
        const cursor = normalizeResumeToken(params.resume_token);

        const result = await this.messageManager.listByOid(auth.oid, {
          pageSize,
          ...(cursor !== undefined && { cursor }),
          ...(params.category !== undefined && { category: params.category }),
          ...(params.contact_id !== undefined &&
            { contactId: params.contact_id }),
          ...(params.remote_domain !== undefined &&
            { remoteDomain: params.remote_domain }),
          ...(params.received_after !== undefined &&
            { receivedAfter: params.received_after }),
          ...(params.received_before !== undefined &&
            { receivedBefore: params.received_before }),
          ...(params.read !== undefined && { read: params.read }),
        });

        const messages = await Promise.all(
          result.messages.map(async (m) => ({
            id: m.id,
            contact_id: m.contact_id,
            message_id: m.message_id,
            remote_domain: m.remote_domain,
            category: m.category,
            content_rating: m.content_rating,
            sent_at: m.sent_at,
            received_at: m.received_at,
            read: m.read,
            ...(m.read_at !== undefined && { read_at: m.read_at }),
            message: m.message,
            ...(m.metadata !== undefined && { metadata: m.metadata }),
            sender_fields: await this.senderFields(auth.oid, m.contact_id),
          })),
        );

        return toolResult({
          messages,
          page_size: pageSize,
          ...(result.nextCursor !== undefined &&
            { next_resume_token: result.nextCursor }),
        });
      }),
    );

    server.registerTool(
      "get_message",
      {
        description:
          "Retrieve a single received message by its wire message_id.",
        inputSchema: GetMessageInputSchema,
        outputSchema: GetMessageOutputSchema,
      },
      withToolErrorHandling(async (params: GetMessageArgs) => {
        const m = await this.messageManager.getByMessageId(
          auth.oid,
          params.message_id,
        );
        if (!m) throw new MessageNotFoundError(params.message_id);
        const sender_fields = await this.senderFields(auth.oid, m.contact_id);
        return toolResult({
          id: m.id,
          contact_id: m.contact_id,
          message_id: m.message_id,
          remote_domain: m.remote_domain,
          category: m.category,
          content_rating: m.content_rating,
          sent_at: m.sent_at,
          received_at: m.received_at,
          read: m.read,
          ...(m.read_at !== undefined && { read_at: m.read_at }),
          message: m.message,
          ...(m.metadata !== undefined && { metadata: m.metadata }),
          sender_fields,
        });
      }),
    );

    server.registerTool(
      "mark_read",
      {
        description: "Mark one or more received messages as read.",
        inputSchema: MarkReadInputSchema,
        outputSchema: MarkReadOutputSchema,
      },
      withToolErrorHandling(async (params: MarkReadArgs) => {
        const result = await this.messageManager.markRead(
          auth.oid,
          params.message_ids,
        );
        return toolResult(result);
      }),
    );

    server.registerTool(
      "delete_message",
      {
        description:
          "Permanently delete a received message from the local inbox. Deletion is local-only.",
        inputSchema: DeleteMessageInputSchema,
        outputSchema: DeleteMessageOutputSchema,
      },
      withToolErrorHandling(async (params: DeleteMessageArgs) => {
        const deleted = await this.messageManager.deleteByMessageId(
          auth.oid,
          params.message_id,
        );
        if (!deleted) throw new MessageNotFoundError(params.message_id);
        return toolResult({
          message_id: params.message_id,
          deleted: true as const,
        });
      }),
    );

    server.registerTool(
      "list_sent_messages",
      {
        description:
          "List messages dispatched by the authenticated account, ordered by sent_at descending.",
        inputSchema: ListSentMessagesInputSchema,
        outputSchema: ListSentMessagesOutputSchema,
      },
      withToolErrorHandling(async (params: ListSentMessagesArgs) => {
        const { normalizePageSize, normalizeResumeToken } = await import(
          "../../utils/pagination.ts"
        );
        const pageSize = normalizePageSize(params.page_size);
        const cursor = normalizeResumeToken(params.resume_token);

        const result = await this.sentMessageManager.listByOid(auth.oid, {
          pageSize,
          ...(cursor !== undefined && { cursor }),
          ...(params.category !== undefined && { category: params.category }),
          ...(params.contact_id !== undefined &&
            { contactId: params.contact_id }),
          ...(params.remote_domain !== undefined &&
            { remoteDomain: params.remote_domain }),
          ...(params.sent_after !== undefined &&
            { sentAfter: params.sent_after }),
          ...(params.sent_before !== undefined &&
            { sentBefore: params.sent_before }),
          ...(params.status !== undefined && { status: params.status }),
        });

        return toolResult({
          messages: result.messages.map((m) => ({
            id: m.id,
            contact_id: m.contact_id,
            message_id: m.message_id,
            remote_domain: m.remote_domain,
            category: m.category,
            content_rating: m.content_rating,
            sent_at: m.sent_at,
            ...(m.subject !== undefined && { subject: m.subject }),
            body: m.body,
            ...(m.metadata !== undefined && { metadata: m.metadata }),
            status: m.status,
          })),
          page_size: pageSize,
          ...(result.nextCursor !== undefined &&
            { next_resume_token: result.nextCursor }),
        });
      }),
    );
  }
}
