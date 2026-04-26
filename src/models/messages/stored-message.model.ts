import { z } from "zod";
import { MESSAGE_CATEGORIES } from "../message-category.ts";

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
});

export type StoredMessage = z.infer<typeof StoredMessageSchema>;
