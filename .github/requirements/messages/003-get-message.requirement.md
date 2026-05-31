---
id: messages-003
title: Listeners can retrieve a single message by ID
spec_ref: "7.1, 12.4"
---

# Get Message

The MCP server MUST expose `get_message` so an authenticated local user can
retrieve the full record of a single message by `envelope_id` (§12.4).

## Expected behavior

- The tool is available to any authenticated account.
- The tool requires `envelope_id`.
- The tool MUST return only messages addressed to a contact owned by the calling
  account. If the message exists but is owned by a different account, the tool
  MUST return a structured not-found error (it MUST NOT distinguish "not yours"
  from "does not exist").
- The returned record MUST include the envelope as received (§7.1):
  `envelope_id`, `sender_domain`, `category`, `content_rating`, `sent_at`,
  `subject`, `body`, `metadata`, plus server-side fields `contact_id`,
  `received_at`, `read`, and `sender_claims` (`req:messages-006`).
- If no message with the given `envelope_id` exists for the calling account, the
  tool MUST return a structured not-found error.
