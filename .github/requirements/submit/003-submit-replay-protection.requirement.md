---
id: submit-003
title: Envelope requests are protected against replay
spec_ref: "6.1, 6.2"
---

# Envelope Replay Protection

The envelope endpoint MUST protect against replay attacks using timestamp
freshness and per-category envelope deduplication (§6.1, §6.2).

## Expected behavior

- The server validates `x-rpp-timestamp` as an ISO 8601 UTC timestamp.
- The server rejects requests whose timestamp differs from current server UTC
  time by more than 60 seconds with `E_REQUEST_STALE` (§13).
- The server maintains a deduplication cache keyed by envelope identity:
  - `message` envelopes: deduplicated by `(sender_domain, envelope_id)`.
  - `invitation` envelopes: deduplicated by `(sender_domain, envelope_id)`.
  - `invitation_reply` envelopes: deduplicated by
    `(sender_domain,
    envelope_id)`. In addition, only one successful
    `invitation_reply` per locally persisted `reply_credential` is ever accepted
    — the first successful reply consumes the credential.
- A duplicate envelope of any category is rejected with `E_DUPLICATE_ENVELOPE`
  (§13).
- A second `invitation_reply` referencing an already-consumed `reply_credential`
  is rejected with `E_INVITATION_NOT_PENDING` (§13) — the upstream invitation is
  no longer in `pending` state.
- The deduplication cache retains entries for at least 60 seconds.
- Timestamp freshness and envelope deduplication work together so a captured
  request cannot be accepted twice within the replay window.
