import { computeHmac } from "./compute-hmac.ts";

export interface SubmitReceiptCallbackOptions {
  invitationId: string;
  deliveryToken: string;
  decision: "accepted" | "rejected";
  receipt?: Record<string, unknown>;
  reason?: string;
  timestamp?: string;
  baseUrl?: string;
}

export async function submitReceiptCallback(
  opts: SubmitReceiptCallbackOptions,
): Promise<Response> {
  const { invitationId, deliveryToken, decision, receipt, reason } = opts;
  const bodyObj: Record<string, unknown> = {
    category: "receipt",
    invitation_id: invitationId,
    decision,
  };
  if (receipt !== undefined) bodyObj.receipt = receipt;
  if (reason !== undefined) bodyObj.reason = reason;
  const bodyJson = JSON.stringify(bodyObj);
  const bodyBytes = new TextEncoder().encode(bodyJson);
  const timestamp = opts.timestamp ?? new Date().toISOString();
  const signature = await computeHmac(deliveryToken, timestamp, bodyBytes);

  return await fetch(
    `${opts.baseUrl ?? "http://localhost:8000"}/rpp/v1/envelopes`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-rpp-invitation-id": invitationId,
        "x-rpp-signature": signature,
        "x-rpp-timestamp": timestamp,
      },
      body: bodyJson,
    },
  );
}
