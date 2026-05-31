import { computeHmac } from "./compute-hmac.ts";
import type { ContactCredentialSeed } from "./seed-contact.ts";

export interface SubmitMessageOptions {
  /** Contact credential used as HMAC key (typically `contact.local_credential`). */
  credential: ContactCredentialSeed;
  /** Wire message_id (UUIDv7). Defaults to a random UUID. */
  messageId?: string;
  /** Sender domain in the envelope. MUST match the contact's remote_domain. */
  senderDomain?: string;
  category?: string;
  contentRating?: string;
  subject?: string;
  body?: { content_type: string; content: string };
  metadata?: Record<string, unknown>;
  sentAt?: Date;
  timestamp?: string;
  baseUrl?: string;
}

/**
 * POST a `message` envelope to the local server, signed with the supplied
 * contact credential. Used by submit-* and messages-* tests.
 */
export async function submitMessageEnvelope(
  opts: SubmitMessageOptions,
): Promise<Response> {
  const messageId = opts.messageId ?? crypto.randomUUID();
  const senderDomain = opts.senderDomain ?? "remote.example";
  const category = opts.category ?? "correspondence";
  const contentRating = opts.contentRating ?? "G";
  const subject = opts.subject ?? "Test";
  const body = opts.body ??
    { content_type: "text/markdown", content: "Hello." };
  const sentAt = (opts.sentAt ?? new Date()).toISOString();

  const envelope: Record<string, unknown> = {
    message_id: messageId,
    sender_domain: senderDomain,
    category,
    content_rating: contentRating,
    sent_at: sentAt,
    subject,
    body,
    ...(opts.metadata !== undefined && { metadata: opts.metadata }),
  };

  const bodyJson = JSON.stringify(envelope);
  const bodyBytes = new TextEncoder().encode(bodyJson);
  const timestamp = opts.timestamp ?? new Date().toISOString();
  const signature = await computeHmac(
    opts.credential.contact_secret,
    timestamp,
    bodyBytes,
  );

  return await fetch(
    `${opts.baseUrl ?? "http://localhost:8000"}/rpp/v1/envelopes`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-rpp-contact-id": opts.credential.contact_id,
        "x-rpp-signature": signature,
        "x-rpp-timestamp": timestamp,
      },
      body: bodyJson,
    },
  );
}
