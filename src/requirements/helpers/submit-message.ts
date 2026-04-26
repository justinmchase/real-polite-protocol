import { computeHmac } from "./compute-hmac.ts";

export interface SubmitMessageOptions {
  receiptId: string;
  receiptSecret: string;
  messageId?: string;
  timestamp?: string;
  senderDomain?: string;
  category?: string;
  baseUrl?: string;
}

export async function submitMessage(
  opts: SubmitMessageOptions,
): Promise<Response> {
  const {
    receiptId,
    receiptSecret,
    messageId = crypto.randomUUID(),
    senderDomain = "sender.example",
    category = "message",
  } = opts;

  const bodyJson = JSON.stringify({
    message_id: messageId,
    sender_domain: senderDomain,
    category,
    sent_at: "2026-04-20T00:00:00Z",
    message: {
      content_rating: "G",
      subject: "Test",
      body: { content_type: "text/markdown", content: "Hello." },
    },
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
