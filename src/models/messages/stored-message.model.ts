import { z } from "zod";
import { MESSAGE_CATEGORIES } from "../message-category.ts";

const MetadataValueSchema = z.union([
  z.string().max(512),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(
    z.union([z.string().max(512), z.number(), z.boolean(), z.null()]),
  ).max(20),
]);

export const MessageMetadataSchema = z
  .record(z.string().max(64), MetadataValueSchema)
  .refine((v) => Object.keys(v).length <= 20, {
    message: "metadata exceeds 20 key limit",
  });

export type MessageMetadata = z.infer<typeof MessageMetadataSchema>;

export const StoredMessageSchema = z.object({
  /** Internal DB ID (UUIDv7). Used as the KV primary key. */
  id: z.string(),
  /** OID of the receiving account. */
  oid: z.string(),
  /** Receipt ID used by the sender for delivery. */
  receipt_id: z.string(),
  /** Wire message_id from the envelope. */
  message_id: z.string(),
  sender_domain: z.string(),
  sender_domain_id: z.string().optional(),
  category: z.enum(MESSAGE_CATEGORIES),
  sent_at: z.coerce.date(),
  received_at: z.coerce.date(),
  read: z.boolean(),
  read_at: z.coerce.date().optional(),
  message: z.object({
    content_rating: z.string(),
    subject: z.string(),
    body: z.object({
      content_type: z.string(),
      content: z.string(),
    }),
  }),
  metadata: MessageMetadataSchema.optional(),
  /**
   * Optional embedded reply invite from the sender (Section 8). When present,
   * the listener MAY use it to initiate a reply invitation flow.
   */
  reply_invite: z.object({
    receptive_policy_id: z.string(),
    receiver_domain: z.string(),
    proposed_terms: z.record(z.string(), z.unknown()).optional(),
    expires_at: z.coerce.date().optional(),
  }).optional(),
});

export type StoredMessage = z.infer<typeof StoredMessageSchema>;
