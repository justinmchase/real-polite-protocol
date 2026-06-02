---
id: messages-010
title: Listeners can read a single message and have it marked as read automatically
spec_ref: "7.1, 12.4"
---

# Read Message

The MCP server MUST expose `read_message` so an authenticated local user can
retrieve the full record of a single received message by `message_id` and have
it atomically marked as read in the same operation (§12.4).

## Expected behavior

- The tool is available to any authenticated account.
- The tool requires `message_id` (wire message ID).
- The tool returns the same response shape as `get_message`
  (`req:messages-003`).
- The tool MUST return only messages addressed to a contact owned by the calling
  account. If the message exists but is owned by a different account, the tool
  MUST return a structured not-found error (it MUST NOT distinguish "not yours"
  from "does not exist").
- If no message with the given `message_id` exists for the calling account, the
  tool MUST return a structured not-found error.
- After retrieving the message, the tool MUST mark it as read if it is not
  already read. If the message is already read, the mark step is a no-op.
- The returned message MUST have `read: true`.
- The `read_at` field MUST be:
  - The message's original `read_at` if it was already read before the call.
  - A server-generated timestamp (at or after the call time) if the message was
    newly marked read by this call.
- The mark-as-read step MUST complete before the response is returned.
