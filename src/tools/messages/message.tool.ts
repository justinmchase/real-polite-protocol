import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { encodeHex } from "@std/encoding/hex";
import { generate as generateUUIDv7 } from "@std/uuid/v7";
import { z } from "zod";
import type { AuthInfo } from "../../context.ts";
import type {
  AccountManager,
  ContactManager,
  MessageManager,
  ReceiptManager,
  SentMessageManager,
} from "../../managers/mod.ts";
import { flatMerge } from "../../managers/contacts/contact.manager.ts";
import { CONTENT_RATINGS, MESSAGE_CATEGORIES } from "../../models/mod.ts";
import { MessageMetadataSchema } from "../../models/messages/stored-message.model.ts";
import type { ConfigService } from "../../services/config/config.service.ts";
import type { MessageEnvelope } from "../../controllers/submit/message-handler.ts";
import { toolResult, withToolErrorHandling } from "../tool-result.ts";
import { inputDate, outputDate } from "../date-schema.ts";
import {
  InvalidBodyError,
  InvalidContentTypeError,
  MessageDeliveryError,
  MessageNotFoundError,
  ReceiptNotActiveError,
} from "./message.error.ts";
import { ReceiptNotFoundError } from "../receipt/receipt.error.ts";
import { MessageTooLargeError } from "../../controllers/submit/submit.error.ts";

const CategorySchema = z.enum(MESSAGE_CATEGORIES);
const ContentRatingSchema = z.enum(CONTENT_RATINGS);

const PERMITTED_CONTENT_TYPES = ["text/markdown", "application/json"] as const;
const MAX_BODY_BYTES = 262144; // 256 KB

const ClaimValueOutputSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])),
]);

const SenderClaimsSchema = z.record(
  z.string(),
  z.object({
    value: ClaimValueOutputSchema,
    source: z.enum([
      "sender_verified",
      "domain_admin",
      "sender_custom",
      "owner_note",
    ]),
    recorded_at: outputDate(),
  }),
);

const ListMessagesInputSchema = {
  category: CategorySchema.optional().describe(
    "Filter by message category",
  ),
  sender_domain: z.string().optional().describe(
    "Filter by sender domain (case-insensitive exact match)",
  ),
  received_after: inputDate().optional().describe(
    "Return only messages received after this ISO 8601 timestamp",
  ),
  received_before: inputDate().optional().describe(
    "Return only messages received before this ISO 8601 timestamp",
  ),
  read: z.boolean().optional().describe(
    "Filter by read status (true = read, false = unread)",
  ),
  page_size: z.number().int().min(1).max(200).optional().describe(
    "Number of messages per page (1–200, default 50)",
  ),
  resume_token: z.string().optional().describe(
    "Opaque token from a previous call to continue pagination",
  ),
};

const StoredMessageSchema = z.object({
  id: z.string(),
  message_id: z.string(),
  sender_domain: z.string(),
  category: CategorySchema,
  sent_at: outputDate(),
  received_at: outputDate(),
  read: z.boolean(),
  message: z.object({
    content_rating: z.string(),
    subject: z.string(),
    body: z.object({
      content_type: z.string(),
      content: z.string(),
    }),
  }),
  metadata: MessageMetadataSchema.optional().describe(
    "Free-form sub-protocol metadata attached by the sender (Section 7.1.3)",
  ),
  sender_claims: SenderClaimsSchema.describe(
    "Current flat-merged contact fields for the message sender (all sources: custom, verified, admin, owner notes). Empty object when no contact exists.",
  ),
  reply_invite: z.object({
    receptive_policy_id: z.string(),
    receiver_domain: z.string(),
    proposed_terms: z.record(z.string(), z.unknown()).optional(),
    expires_at: outputDate().optional(),
  }).optional().describe(
    "Embedded reply invite (Section 8). When present, use receptive_policy_id and receiver_domain to send a reply invitation.",
  ),
});

const ListMessagesOutputSchema = {
  messages: z.array(StoredMessageSchema).describe("List of received messages"),
  page_size: z.number().describe("Effective page size used"),
  next_resume_token: z.string().optional().describe(
    "Token to pass as resume_token for the next page; absent when no more pages",
  ),
};

type ListMessagesArgs = z.infer<z.ZodObject<typeof ListMessagesInputSchema>>;

const GetMessageInputSchema = {
  message_id: z.string().describe("ID of the message to retrieve"),
};

const GetMessageOutputSchema = {
  ...StoredMessageSchema.shape,
};

type GetMessageArgs = z.infer<z.ZodObject<typeof GetMessageInputSchema>>;

const MarkReadInputSchema = {
  message_ids: z.array(z.string()).min(1).describe(
    "One or more message_id values to mark as read",
  ),
};

const MarkReadOutputSchema = {
  marked: z.array(z.string()).describe(
    "message_id values transitioned from unread to read",
  ),
  already_read: z.array(z.string()).describe(
    "message_id values that were already read",
  ),
  not_found: z.array(z.string()).describe(
    "message_id values that did not match any message owned by the caller",
  ),
};

type MarkReadArgs = z.infer<z.ZodObject<typeof MarkReadInputSchema>>;

const DeleteMessageInputSchema = {
  message_id: z.string().describe("ID of the message to delete"),
};

const DeleteMessageOutputSchema = {
  message_id: z.string().describe("ID of the deleted message"),
  deleted: z.literal(true).describe(
    "Confirmation that the message was deleted",
  ),
};

type DeleteMessageArgs = z.infer<z.ZodObject<typeof DeleteMessageInputSchema>>;

const SendMessageInputSchema = {
  receipt_id: z.uuid().describe(
    "ID of the held receipt authorizing this send",
  ),
  category: CategorySchema.describe("Message category (must match receipt)"),
  content_rating: ContentRatingSchema.describe(
    "Content rating of this message",
  ),
  body: z.object({
    content_type: z.enum(PERMITTED_CONTENT_TYPES).describe(
      "Body content type: text/markdown or application/json",
    ),
    content: z.string().describe("Body content string"),
  }).describe("Message body"),
  subject: z.string().optional().describe("Informational subject line"),
  sender_display_name: z.string().max(256).optional().describe(
    "Optional display name for the sender (Section 3A.2)",
  ),
  metadata: MessageMetadataSchema.optional().describe(
    "Free-form metadata passed through to the receiver (Section 7.1.3)",
  ),
  reply_invite: z.object({
    receptive_policy_id: z.uuid().describe(
      "UUID of an active receptive policy the receiver may use to reply",
    ),
    proposed_terms: z.object({
      category: z.enum(MESSAGE_CATEGORIES),
      max_content_rating: z.enum(CONTENT_RATINGS).optional(),
      usage_policy: z.enum(["one-time", "multiple-time", "any-time"])
        .optional(),
    }).passthrough().optional().describe(
      "Suggested receipt terms informational only; sender is not bound by them",
    ),
    expires_at: inputDate().optional().describe(
      "Hint: when the receptive policy window is expected to close",
    ),
  }).optional().describe(
    "Embedded reply invite (Section 8). Offers the receiver a path to reply without a prior receipt.",
  ),
};

const SendMessageOutputSchema = {
  message_id: z.uuid().describe("Generated UUIDv7 message ID"),
  sent_at: outputDate().describe(
    "ISO 8601 timestamp of when the message was sent",
  ),
  accepted: z.boolean().describe("Whether the receiver accepted the message"),
};

const SentMessageSchema = z.object({
  id: z.string(),
  message_id: z.string(),
  receipt_id: z.string(),
  receiver_domain: z.string(),
  category: CategorySchema,
  content_rating: ContentRatingSchema,
  sent_at: outputDate(),
  subject: z.string().optional(),
  body: z.object({
    content_type: z.string(),
    content: z.string(),
  }),
  metadata: MessageMetadataSchema.optional(),
  reply_invite: z.object({
    receptive_policy_id: z.string(),
    receiver_domain: z.string(),
    proposed_terms: z.record(z.string(), z.unknown()).optional(),
    expires_at: outputDate().optional(),
  }).optional(),
  status: z.enum(["delivered", "failed"]),
});

const ListSentMessagesInputSchema = {
  category: CategorySchema.optional().describe("Filter by message category"),
  receiver_domain: z.string().optional().describe(
    "Filter by receiver domain (case-insensitive exact match)",
  ),
  sent_after: inputDate().optional().describe(
    "Return only messages sent after this ISO 8601 timestamp",
  ),
  sent_before: inputDate().optional().describe(
    "Return only messages sent before this ISO 8601 timestamp",
  ),
  status: z.enum(["delivered", "failed"]).optional().describe(
    "Filter by delivery outcome",
  ),
  page_size: z.number().int().min(1).max(200).optional().describe(
    "Number of messages per page (1–200, default 50)",
  ),
  resume_token: z.string().optional().describe(
    "Opaque token from a previous call to continue pagination",
  ),
};

const ListSentMessagesOutputSchema = {
  messages: z.array(SentMessageSchema).describe("List of sent messages"),
  page_size: z.number().describe("Effective page size used"),
  next_resume_token: z.string().optional().describe(
    "Token to pass as resume_token for the next page; absent when no more pages",
  ),
};

type ListSentMessagesArgs = z.infer<
  z.ZodObject<typeof ListSentMessagesInputSchema>
>;

type SendMessageArgs = z.infer<z.ZodObject<typeof SendMessageInputSchema>>;

async function signHmac(
  secret: string,
  timestamp: string,
  bodyBytes: Uint8Array,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const prefix = new TextEncoder().encode(`${timestamp}.`);
  const combined = new Uint8Array(prefix.length + bodyBytes.length);
  combined.set(prefix, 0);
  combined.set(bodyBytes, prefix.length);
  const sig = await crypto.subtle.sign("HMAC", key, combined);
  return encodeHex(new Uint8Array(sig));
}

export class MessageTool {
  constructor(
    private readonly receiptManager: ReceiptManager,
    private readonly accountManager: AccountManager,
    private readonly config: ConfigService,
    private readonly messageManager: MessageManager,
    private readonly contactManager: ContactManager,
    private readonly sentMessageManager: SentMessageManager,
  ) {}

  private async getSenderClaims(
    oid: string,
    senderDomain: string,
    senderDomainId: string | undefined,
  ): Promise<Record<string, unknown>> {
    if (!senderDomainId) return {};
    const contact = await this.contactManager.getByDomainKey(
      oid,
      senderDomain,
      senderDomainId,
    );
    if (!contact) return {};
    return flatMerge(contact.fields) as Record<string, unknown>;
  }

  register(server: McpServer, auth: AuthInfo): void {
    server.registerTool(
      "send_message",
      {
        description:
          "Send a message to another RPP domain using a held receipt. " +
          "The server performs HMAC signing and HTTP delivery on your behalf.",
        inputSchema: SendMessageInputSchema,
        outputSchema: SendMessageOutputSchema,
      },
      withToolErrorHandling(async (params: SendMessageArgs) => {
        // 1. Look up receipt and verify ownership
        const receipt = await this.receiptManager.get(params.receipt_id);
        if (!receipt) {
          throw new ReceiptNotFoundError(params.receipt_id);
        }
        if (receipt.oid !== auth.oid) {
          throw new ReceiptNotFoundError(params.receipt_id);
        }

        // 2. Verify receipt is active
        if (receipt.status !== "active") {
          throw new ReceiptNotActiveError(params.receipt_id);
        }

        // 3. Validate content_type
        if (
          !PERMITTED_CONTENT_TYPES.includes(
            params.body
              .content_type as (typeof PERMITTED_CONTENT_TYPES)[number],
          )
        ) {
          throw new InvalidContentTypeError(params.body.content_type);
        }

        // 4. Validate JSON body syntax if content_type is application/json
        if (params.body.content_type === "application/json") {
          try {
            const parsed = JSON.parse(params.body.content);
            if (typeof parsed !== "object" || parsed === null) {
              throw new InvalidBodyError(
                "Top-level value must be an object or array",
              );
            }
          } catch (e) {
            if (e instanceof InvalidBodyError) throw e;
            throw new InvalidBodyError("Body is not syntactically valid JSON");
          }
        }

        // 5. Get sender's domain_id for the envelope
        const metadata = await this.accountManager.getUserVerifiedMetadata(
          auth.oid,
        );
        const senderDomainId = metadata?.immutable_fields?.["domain_id"] as
          | string
          | undefined;

        // 6. Construct the message envelope
        const messageId = generateUUIDv7();
        const sentAt = new Date();

        const envelope = {
          message_id: messageId,
          sender_domain: this.config.domain,
          ...(senderDomainId !== undefined && {
            sender_domain_id: senderDomainId,
          }),
          ...(params.sender_display_name !== undefined && {
            sender_display_name: params.sender_display_name,
          }),
          category: "message",
          sent_at: sentAt,
          message: {
            content_rating: params.content_rating,
            subject: params.subject ?? "",
            body: {
              content_type: params.body.content_type,
              content: params.body.content,
            },
          },
          ...(params.metadata !== undefined && { metadata: params.metadata }),
          ...(params.reply_invite !== undefined && {
            reply_invite: {
              receptive_policy_id: params.reply_invite.receptive_policy_id,
              receiver_domain: this.config.domain, // always the sender's domain
              ...(params.reply_invite.proposed_terms !== undefined && {
                proposed_terms: params.reply_invite.proposed_terms,
              }),
              ...(params.reply_invite.expires_at !== undefined && {
                expires_at: params.reply_invite.expires_at,
              }),
            },
          }),
        };

        // 7. Serialize and check size
        const bodyJson = JSON.stringify(envelope);
        const bodyBytes = new TextEncoder().encode(bodyJson);
        if (bodyBytes.byteLength > MAX_BODY_BYTES) {
          throw new MessageTooLargeError(bodyBytes.byteLength, MAX_BODY_BYTES);
        }

        // 8. Sign with HMAC-SHA-256
        const timestamp = new Date().toISOString();
        const signature = await signHmac(receipt.secret, timestamp, bodyBytes);

        // 9. Determine delivery path
        const receiverDomain = receipt.sender_domain;

        // 10. Deliver the message
        if (receiverDomain === this.config.domain) {
          // Same-domain: bypass HTTP to avoid Deno Deploy 508 self-loop.
          // Resolve the recipient's local OID from the receipt's
          // `sender_domain_id` (the destination identity captured when the
          // receipt was issued). The OID is never serialized — we only use it
          // here to route storage to the correct local inbox.
          if (!receipt.sender_domain_id) {
            throw new MessageDeliveryError(
              receiverDomain,
              500,
              "E_RECEIPT_MISSING_SENDER_DOMAIN_ID",
            );
          }
          const recipientOid = await this.accountManager.findOidByDomainId(
            receipt.sender_domain_id,
          );
          if (!recipientOid) {
            throw new MessageDeliveryError(
              receiverDomain,
              404,
              "E_RECIPIENT_NOT_FOUND",
            );
          }
          // Store the message directly — identical to ReceiptMessageHandler.
          await this.messageManager.store(
            recipientOid,
            receipt.id,
            receipt.category,
            envelope as MessageEnvelope,
          );
        } else {
          const isLocalhost = receiverDomain === "localhost" ||
            receiverDomain.startsWith("localhost:");
          const scheme = isLocalhost ? "http" : "https";
          const url = `${scheme}://${receiverDomain}/rpp/v1/envelopes`;

          const response = await fetch(url, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-rpp-receipt-id": receipt.id,
              "x-rpp-signature": signature,
              "x-rpp-timestamp": timestamp,
            },
            body: bodyJson,
          });

          if (!response.ok) {
            let receiverCode: string | undefined;
            try {
              const errorBody = await response.json() as Record<
                string,
                unknown
              >;
              receiverCode = typeof errorBody.code === "string"
                ? errorBody.code
                : undefined;
            } catch {
              // ignore parse failure
            }
            // Store a failed outbox record before surfacing the error (§7.1.4)
            await this.sentMessageManager.store({
              oid: auth.oid,
              message_id: messageId,
              receipt_id: receipt.id,
              receiver_domain: receiverDomain,
              category: params.category,
              content_rating: params.content_rating,
              sent_at: sentAt,
              ...(params.subject !== undefined && { subject: params.subject }),
              body: params.body,
              ...(params.metadata !== undefined &&
                { metadata: params.metadata }),
              ...(params.reply_invite !== undefined && {
                reply_invite: envelope.reply_invite,
              }),
              status: "failed",
            });
            throw new MessageDeliveryError(
              receiverDomain,
              response.status,
              receiverCode,
            );
          }

          await response.body?.cancel();
        }

        // Store outbox record (§7.1.4)
        await this.sentMessageManager.store({
          oid: auth.oid,
          message_id: messageId,
          receipt_id: receipt.id,
          receiver_domain: receiverDomain,
          category: params.category,
          content_rating: params.content_rating,
          sent_at: sentAt,
          ...(params.subject !== undefined && { subject: params.subject }),
          body: params.body,
          ...(params.metadata !== undefined && { metadata: params.metadata }),
          ...(params.reply_invite !== undefined && {
            reply_invite: envelope.reply_invite,
          }),
          status: "delivered",
        });

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
          "List messages received by your account. Returns only messages " +
          "addressed to the calling account's OID, ordered by received_at descending.",
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
          category: params.category,
          senderDomain: params.sender_domain,
          receivedAfter: params.received_after,
          receivedBefore: params.received_before,
          read: params.read,
          pageSize,
          cursor,
        });

        const messagesWithClaims = await Promise.all(
          result.messages.map(async (msg) => ({
            ...msg,
            sender_claims: await this.getSenderClaims(
              auth.oid,
              msg.sender_domain,
              msg.sender_domain_id,
            ),
          })),
        );

        return toolResult({
          messages: messagesWithClaims,
          page_size: pageSize,
          next_resume_token: result.nextCursor,
        });
      }),
    );

    server.registerTool(
      "get_message",
      {
        description:
          "Retrieve a single message by its message_id. Returns only messages " +
          "whose receipt was issued to the calling account.",
        inputSchema: GetMessageInputSchema,
        outputSchema: GetMessageOutputSchema,
      },
      withToolErrorHandling(async (params: GetMessageArgs) => {
        const message = await this.messageManager.getByMessageId(
          auth.oid,
          params.message_id,
        );
        if (!message) {
          throw new MessageNotFoundError(params.message_id);
        }
        const sender_claims = await this.getSenderClaims(
          auth.oid,
          message.sender_domain,
          message.sender_domain_id,
        );
        return toolResult({ ...message, sender_claims });
      }),
    );

    server.registerTool(
      "mark_read",
      {
        description:
          "Mark one or more received messages as read. Only messages owned by " +
          "the calling account are updated; unowned IDs are silently placed in " +
          "not_found. Already-read messages are not re-stamped.",
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
          "Permanently delete a message from your inbox. Only messages owned by " +
          "the calling account can be deleted. Deletion is local-only and does " +
          "not notify the sender or affect any associated receipt.",
        inputSchema: DeleteMessageInputSchema,
        outputSchema: DeleteMessageOutputSchema,
      },
      withToolErrorHandling(async (params: DeleteMessageArgs) => {
        const deleted = await this.messageManager.deleteByMessageId(
          auth.oid,
          params.message_id,
        );
        if (!deleted) {
          throw new MessageNotFoundError(params.message_id);
        }
        return toolResult({ message_id: params.message_id, deleted: true });
      }),
    );

    server.registerTool(
      "list_sent_messages",
      {
        description:
          "List messages you have sent. Returns outbox records for the calling " +
          "account, ordered by sent_at descending. Includes delivery status.",
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
          category: params.category,
          receiverDomain: params.receiver_domain,
          sentAfter: params.sent_after,
          sentBefore: params.sent_before,
          status: params.status,
          pageSize,
          cursor,
        });

        return toolResult({
          messages: result.messages,
          page_size: pageSize,
          next_resume_token: result.nextCursor,
        });
      }),
    );
  }
}
