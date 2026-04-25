---
id: submit-003
title: Submit requests are protected against replay
---

# Submit Replay Protection

The submit endpoint MUST protect against replay attacks using timestamp
freshness and message id deduplication (Section 5.1.1).

## Expected behavior

- The server validates `x-rpp-timestamp` as an ISO 8601 UTC timestamp.
- The server rejects requests whose timestamp differs from current server UTC
  time by more than 60 seconds with `E_REQUEST_STALE`.
- The server maintains a deduplication cache of recently accepted
  `(sender_domain, message_id)` pairs.
- If the same `message_id` is submitted again from the same `sender_domain`
  within the deduplication window, the server rejects it with
  `E_DUPLICATE_MESSAGE`.
- The deduplication cache retains entries for at least 60 seconds.
- Timestamp freshness and message id deduplication work together so a captured
  request cannot be accepted twice within the replay window.
