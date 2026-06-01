---
id: messages-008
title: Listeners can list messages they have sent (outbox)
spec_ref: "7, 12.4"
---

# List Sent Messages

The MCP server MUST expose `list_sent_messages` so an authenticated local user
can enumerate messages they have previously sent (§12.4).

The server MUST store an outbox record for every `send_message` attempt so the
local user has a delivery audit trail.

## Expected behavior

- The tool is available to any authenticated account.
- The tool returns only outbox records owned by the calling account (by OID).
  Outbox records belonging to other accounts MUST NOT be visible.
- Each returned record includes at minimum: `envelope_id`, `contact_id`,
  `remote_domain`, `category`, `content_rating`, `sent_at`, `subject` (when
  present), `body`, `status` (`"delivered"` or `"failed"`), and `metadata` (when
  present).
- The tool MUST support filtering by:
  - `category` — one value from the category registry.
  - `contact_id` — narrow to messages sent to a single contact.
  - `remote_domain` — exact match (case-insensitive).
  - `sent_after` / `sent_before` — ISO 8601 timestamps for date-range filtering.
  - `status` — `"delivered"` or `"failed"` to narrow by delivery outcome.
- Results MUST be ordered by `sent_at` descending by default.
- Results MUST be paginated via resume-token pagination (§12.8): request accepts
  `page_size` and `resume_token`; response returns the `messages` array and an
  optional `next_resume_token`.
- Offset-based pagination MUST NOT be used.

## Outbox record creation

- The server MUST write an outbox record immediately after receiving a 2xx
  response from the remote (status `"delivered"`).
- The server MUST also write an outbox record with status `"failed"` when the
  remote returns a non-2xx, so the sender has a delivery audit trail.
- Outbox records MUST be keyed per-account and MUST NOT be visible to other
  accounts.
