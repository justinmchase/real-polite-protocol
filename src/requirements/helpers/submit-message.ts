import { computeHmac } from "./compute-hmac.ts";

export interface SubmitMessageOptions {
  receiptId: string;
  receiptSecret: string;
  messageId?: string;
  timestamp?: string;
  senderDomain?: string;
  senderDomainId?: string;
  category?: string;
  baseUrl?: string;
  metadata?: Record<string, unknown>;
}

export async function submitMessage(
  opts: SubmitMessageOptions,
): Promise<Response> {
  const {
    receiptId,
    receiptSecret,
    messageId = crypto.randomUUID(),
    senderDomain = "sender.example",
    senderDomainId,
    category = "message",
  } = opts;

  const bodyJson = JSON.stringify({
    message_id: messageId,
    sender_domain: senderDomain,
    ...(senderDomainId !== undefined
      ? { sender_domain_id: senderDomainId }
      : {}),
    category,
    sent_at: "2026-04-20T00:00:00Z",
    message: {
      content_rating: "G",
      subject: "Test",
      body: { content_type: "text/markdown", content: "Hello." },
    },
    ...(opts.metadata !== undefined ? { metadata: opts.metadata } : {}),
  });
  const bodyBytes = new TextEncoder().encode(bodyJson);
  const timestamp = opts.timestamp ?? new Date().toISOString();
  const signature = await computeHmac(receiptSecret, timestamp, bodyBytes);

  return await fetch(
    `${opts.baseUrl ?? "http://localhost:8000"}/rpp/v1/envelopes`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-rpp-receipt-id": receiptId,
        "x-rpp-signature": signature,
        "x-rpp-timestamp": timestamp,
      },
      body: bodyJson,
    },
  );
}
