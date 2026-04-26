---
id: invitations-008
title: Inviting domains process inbound receipt callbacks to finalize invitations
---

# Receipt Callback Handler (Sender Side)

The original sender of an invitation MUST process inbound `category: "receipt"`
envelopes delivered to its envelope endpoint (Section 9.7.2, Section 9.7.3). The
handler is what transitions a locally-pending invitation to its terminal state
and persists the issued receipt (when accepted).

## Expected behavior

- The envelope endpoint dispatches an inbound envelope with
  `category: "receipt"` to the receipt-callback handler after generic envelope
  validation (`submit-004`) and HMAC verification (`submit-002`, `submit-003`).
- The handler locates the local invitation record by `invitation_id`. If no
  matching invitation exists, the request is rejected with
  `E_INVITATION_NOT_FOUND`.
- The handler verifies the invitation is still in `pending` state. A callback
  for an invitation already in a terminal state is rejected with
  `E_INVITATION_NOT_PENDING`.
- The handler verifies the invitation has not expired. Expired invitations are
  rejected with `E_INVITATION_EXPIRED`.
- The handler verifies the request HMAC was computed using the invitation's
  recorded `delivery_token`. Mismatch is rejected with
  `E_DELIVERY_TOKEN_INVALID`. A token already consumed by a previous successful
  callback is rejected with `E_DELIVERY_TOKEN_CONSUMED`. A token past its
  `expires_at` is rejected with `E_DELIVERY_TOKEN_EXPIRED`.
- On `decision: "accepted"`:
  - The handler validates and stores the embedded `receipt` object so it can be
    used to send messages on the established relationship.
  - The handler MUST trigger receipt-superseding semantics (`receipts-004`) if
    applicable.
  - The local invitation transitions to `accepted` and the `delivery_token` is
    marked consumed.
- On `decision: "rejected"`:
  - No receipt is stored.
  - The local invitation transitions to `rejected` and the `delivery_token` is
    marked consumed.
- The handler responds with HTTP 202 and a body of
  `{ ok: true, accepted: true, invitation_id }`.
- The handler MUST be idempotent against the network retry semantics in
  `invitations-007`: a successful first call consumes the token; a retried
  duplicate is rejected per the deduplication rules in `submit-003`.
