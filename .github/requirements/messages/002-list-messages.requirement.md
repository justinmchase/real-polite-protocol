---
id: messages-002
title: Listeners can list messages in their inbox
spec_ref: "7, 12.4, 12.8"
---

# List Messages

The MCP server MUST expose `list_messages` so an authenticated local user can
enumerate messages addressed to their account (§12.4).

## Expected behavior

- The tool is available to any authenticated account.
- The tool returns only messages addressed to a contact owned by the calling
  account (by OID). Messages addressed to other accounts MUST NOT be visible.
- Each returned message includes at minimum: `envelope_id`, `contact_id`,
  `sender_domain`, `category`, `content_rating`, `sent_at`, `received_at`,
  `subject`, `read`, the `body` (or snippet per the tool's response shape),
  `metadata` (when present, `req:messages-007`), and `sender_claims` (the
  current flat-merged contact fields, `req:messages-006`).
- The tool MUST support filtering by:
  - `category` — one or more category registry values.
  - `contact_id` — narrow to messages from a single contact.
  - `sender_domain` — exact match (case-insensitive).
  - `received_after` / `received_before` — ISO 8601 timestamps.
  - `read` — boolean to restrict to read or unread messages.
- Results MUST be ordered by `received_at` descending by default.
- Results MUST be paginated via resume-token pagination (§12.8): request accepts
  `page_size` and `resume_token`; response returns the `messages` array and an
  optional `next_resume_token`.
- Offset-based pagination MUST NOT be used.
