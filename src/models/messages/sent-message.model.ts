import { z } from "zod";
import { MESSAGE_CATEGORIES } from "../message-category.ts";
import { CONTENT_RATINGS } from "../content-rating.ts";
import { MessageMetadataSchema } from "./stored-message.model.ts";

/**
 * A message dispatched outbound from a local account to a contact. Identity
 * is anchored on the contact; the local domain HMAC-signs the envelope using
 * the contact's `remote_credential` (spec §11.3 / §11.5).
 */
export const SentMessageSchema = z.object({
  /** Internal DB ID (UUIDv7). KV primary key. */
  id: z.string(),
  /** OID of the sending local account. */
  oid: z.string(),
  /** ID of the local Contact record this message was sent through. */
  contact_id: z.string(),
  /** Wire `message_id` from the envelope. */
  message_id: z.string(),
  /** Denormalized from the contact for query convenience. */
  remote_domain: z.string(),
  category: z.enum(MESSAGE_CATEGORIES),
  content_rating: z.enum(CONTENT_RATINGS),
  sent_at: z.coerce.date(),
  subject: z.string().optional(),
  body: z.object({
    content_type: z.string(),
    content: z.string(),
  }),
  metadata: MessageMetadataSchema.optional(),
  /** Delivery outcome written after the send attempt. */
  status: z.enum(["delivered", "failed"]),
});

export type SentMessage = z.infer<typeof SentMessageSchema>;
