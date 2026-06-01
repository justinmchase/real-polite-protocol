import { z } from "zod";
import { CONTENT_RATINGS } from "../content-rating.ts";
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

/**
 * A message persisted in a local account's inbox after successful inbound
 * envelope routing (spec §11.3). Identity is anchored on the contact (not on
 * any per-message credential).
 */
export const StoredMessageSchema = z.object({
  /** Internal DB ID (UUIDv7). KV primary key. */
  id: z.string(),
  /** OID of the receiving local account. */
  oid: z.string(),
  /** ID of the local Contact record this message was authenticated against. */
  contact_id: z.string(),
  /** Wire `message_id` from the envelope. */
  message_id: z.string(),
  /** Denormalized from the contact for query convenience. */
  remote_domain: z.string(),
  category: z.enum(MESSAGE_CATEGORIES),
  content_rating: z.enum(CONTENT_RATINGS),
  sent_at: z.coerce.date(),
  received_at: z.coerce.date(),
  read: z.boolean(),
  read_at: z.coerce.date().optional(),
  message: z.object({
    subject: z.string(),
    body: z.object({
      content_type: z.string(),
      content: z.string(),
    }),
  }),
  metadata: MessageMetadataSchema.optional(),
});

export type StoredMessage = z.infer<typeof StoredMessageSchema>;
