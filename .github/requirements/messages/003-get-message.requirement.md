---
id: messages-003
title: Listeners can retrieve a single message by ID
spec_ref: "10B.1, 7.1"
---

# Get Message

The MCP server MUST expose `get_message` so an authenticated listener can
retrieve the full record of a single message by `message_id` (Section 10B.1).

## Expected behavior

- The tool is available to any authenticated account.
- The tool requires `message_id`.
- The tool MUST return only messages whose receiving receipt was issued by the
  calling account. If the message exists but belongs to a different account, the
  tool MUST return a structured not-found error (it MUST NOT distinguish "not
  yours" from "does not exist").
- The returned record MUST include the full envelope as received (Section 7.1):
  `message_id`, `sender_domain`, `sender_display_name` (if any), `category`,
  `content_rating`, `sent_at`, `subject`, `body`, `reply_invite` (if any),
  `metadata`, plus server-side fields `received_at`, `read`, and `sender_claims`
  (see `messages-006`).
- If no message with the given `message_id` exists for the calling account, the
  tool MUST return a structured not-found error.

## Out of scope

- Marking the message as read (use `mark_read`, Section 10B.1).
- Modifying the message record.
