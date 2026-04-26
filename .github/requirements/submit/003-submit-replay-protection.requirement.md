---
id: submit-003
title: Envelope requests are protected against replay
---

# Envelope Replay Protection

The envelope endpoint MUST protect against replay attacks using timestamp
freshness and per-kind envelope deduplication (Section 5.1.1).

## Expected behavior

- The server validates `x-rpp-timestamp` as an ISO 8601 UTC timestamp.
- The server rejects requests whose timestamp differs from current server UTC
  time by more than 60 seconds with `E_REQUEST_STALE`.
- The server maintains a deduplication cache keyed by envelope identity:
  - `message` envelopes: deduplicated by `(sender_domain, message_id)`.
  - `invitation` envelopes: deduplicated by `(sender_domain, invitation_id)`.
  - `receipt` envelopes: deduplicated by `invitation_id` (only one terminal
    callback per invitation is ever valid).
- A duplicate `message` or `invitation` envelope is rejected with
  `E_DUPLICATE_MESSAGE`.
- A duplicate `receipt` callback for the same `invitation_id` is rejected with
  `E_INVITATION_NOT_PENDING` (the first successful callback transitions the
  invitation out of `pending` and consumes the delivery token).
- The deduplication cache retains entries for at least 60 seconds.
- Timestamp freshness and envelope deduplication work together so a captured
  request cannot be accepted twice within the replay window.
