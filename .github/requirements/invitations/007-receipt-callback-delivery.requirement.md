---
id: invitations-007
title: Receivers deliver an acceptance or rejection callback to the inviting domain
---

# Receipt Callback Delivery (Receiver Side)

When a listener accepts or rejects a pending invitation, the receiver's server
MUST asynchronously deliver a `category: "receipt"` envelope (the _receipt
callback_) to the inviting domain's envelope endpoint (Section 9.7, Section
9.7.2, Section 9.7.4).

The callback is the canonical mechanism by which the original sender learns the
outcome of an invitation. Local invitation state on the receiver side is not
considered terminal until the callback is successfully delivered (or the
receiver has exhausted its retry budget and marked it `undelivered`).

## Expected behavior

- The server resolves the inviting domain's envelope endpoint either from a
  cached domain identity record (Section 12.1, well-known) or by falling back to
  the conventional `/rpp/v1/envelopes` path on the domain captured in
  `delivery.domain` of the original invitation.
- The server constructs a receipt envelope with:
  - `category: "receipt"`,
  - `invitation_id` matching the source invitation,
  - `decision: "accepted"` or `decision: "rejected"`,
  - when accepted, the freshly issued `receipt` object (id, secret, category,
    max_content_rating, usage_policy, issued_at),
  - optional `reason` (informational, for either decision).
- The server signs the request with HMAC-SHA-256 using the original invitation's
  `delivery.token` as the key. The server sends `x-rpp-invitation-id`,
  `x-rpp-timestamp`, and `x-rpp-signature` headers. No `x-rpp-receipt-id` header
  is sent on a receipt callback.
- Delivery is idempotent: the server uses the same `invitation_id` across
  retries so that the inviting side can deduplicate (per `submit-003`).
- On transient failure (network error, 5xx, 408, 429), the server retries with
  bounded exponential backoff up to the implementation's retry budget.
- On permanent failure (4xx other than the above, or retry budget exhausted),
  the server marks the local invitation `undelivered` so it can be surfaced to
  the listener and operator. The local terminal state (`accepted` or `rejected`)
  is recorded once the callback succeeds.
- The `delivery.token` is single-use and MUST NOT be sent on any subsequent
  request after the inviting domain confirms acceptance with HTTP 202.
- Auto-accept inline optimization (Section 7.4, Section 9.7.5) MAY return the
  receipt synchronously in the original invitation submission's response body in
  lieu of a separate callback request; in that case no out-of-band callback is
  sent.
