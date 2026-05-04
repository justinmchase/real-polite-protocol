---
id: messages-008
title: Listeners can list messages they have sent (outbox)
spec_ref: "7.1.4, 10B.1"
---

# List Sent Messages

The MCP server MUST expose `list_sent_messages` so an authenticated listener can
enumerate messages they have previously sent (Section 7.1.4, Section 10B.1).

The server MUST store an outbox record for every successfully submitted message
as described in Section 7.1.4. This tool surfaces those records.

## Expected behavior

- The tool is available to any authenticated account.
- The tool returns only outbox records owned by the calling account (by OID).
  Outbox records belonging to other accounts MUST NOT be visible.
- Each returned record includes at minimum: `message_id`, `receiver_domain`,
  `receipt_id`, `category`, `content_rating`, `sent_at`, `subject` (when
  present), `body`, `status` (`"delivered"` or `"failed"`), `metadata` (when
  present), and `reply_invite` (when present).
- The tool MUST support filtering by:
  - `category` — one value from the category registry.
  - `receiver_domain` — exact match (case-insensitive).
  - `sent_after` / `sent_before` — ISO 8601 timestamps for date-range filtering.
  - `status` — `"delivered"` or `"failed"` to narrow by delivery outcome.
- Results MUST be ordered by `sent_at` descending by default.
- Results MUST be paginated via resume-token-based pagination (Section 10B.10):
  request accepts `page_size` and `resume_token`; response returns the
  `messages` array and an optional `next_resume_token`.
- Offset-based pagination MUST NOT be used.

## Outbox record creation

- The server MUST write an outbox record immediately after receiving a 2xx
  response from the receiver (status `"delivered"`).
- The server MUST also write an outbox record with status `"failed"` when the
  receiver returns a non-2xx, so the sender has a delivery audit trail.
- Outbox records MUST be keyed per-account and MUST NOT be visible to other
  accounts.

## Out of scope

- Resending or retrying failed messages (out of scope for this requirement).
- Group messages (`list_group_messages` is separate, Section 10B.2).
- Full-text search of outbox bodies.
