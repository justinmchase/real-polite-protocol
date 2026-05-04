import { z } from "zod";
import { MESSAGE_CATEGORIES } from "../message-category.ts";
import { CONTENT_RATINGS } from "../content-rating.ts";
import { MessageMetadataSchema } from "./stored-message.model.ts";

export const SentMessageSchema = z.object({
  /** Internal DB ID (UUIDv7). Used as the KV primary key. */
  id: z.string(),
  /** OID of the sending account. */
  oid: z.string(),
  /** Wire message_id from the envelope. */
  message_id: z.string(),
  /** Receipt used to authorize and sign the send. */
  receipt_id: z.string(),
  /** Domain the message was delivered to (= receipt.sender_domain). */
  receiver_domain: z.string(),
  category: z.enum(MESSAGE_CATEGORIES),
  content_rating: z.enum(CONTENT_RATINGS),
  sent_at: z.coerce.date(),
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
    expires_at: z.coerce.date().optional(),
  }).optional(),
  /** Delivery outcome written after the send attempt. */
  status: z.enum(["delivered", "failed"]),
});

export type SentMessage = z.infer<typeof SentMessageSchema>;
