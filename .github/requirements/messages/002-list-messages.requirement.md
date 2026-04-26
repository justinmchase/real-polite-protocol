---
id: messages-002
title: Listeners can list messages in their inbox
spec_ref: "10B.1, 7"
---

# List Messages

The MCP server MUST expose `list_messages` so an authenticated listener can
enumerate messages addressed to their account (Section 10B.1).

## Expected behavior

- The tool is available to any authenticated account.
- The tool returns only messages whose receiving receipt was issued by the
  calling account (by OID). Messages addressed to other accounts MUST NOT be
  visible.
- Each returned message includes at minimum: `message_id`, `sender_domain`,
  `category`, `content_rating`, `sent_at`, `received_at`, `subject`, `read`
  (boolean), a snippet or full `body` per the tool's response shape, and
  `sender_claims` (see `messages-006`).
- The tool MUST support filtering by:
  - `category` — one or more category registry values.
  - `sender_domain` — exact match (case-insensitive).
  - `received_after` / `received_before` — ISO 8601 timestamps for date-range
    filtering.
  - `read` — boolean to restrict to read or unread messages.
- Results MUST be ordered by `received_at` descending by default.
- Results MUST be paginated via resume-token-based pagination (Section 10B.10):
  request accepts `page_size` and `resume_token`; response returns the
  `messages` array and an optional `next_resume_token`.
- Offset-based pagination MUST NOT be used.

## Out of scope

- Group messages (`list_group_messages` is separate, Section 10B.2).
- Full-text search of message bodies.
