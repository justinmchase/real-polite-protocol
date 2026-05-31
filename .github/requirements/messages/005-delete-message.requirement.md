---
id: messages-005
title: Listeners can delete a message from their local store
spec_ref: "12.4"
---

# Delete Message

The MCP server MUST expose `delete_message` so an authenticated local user can
permanently remove a message from their local inbox (§12.4).

Deletion is local-only: the sender's copy of the message is unaffected, and no
notification is sent to the sender.

## Expected behavior

- The tool is available to any authenticated account.
- The tool requires `envelope_id`.
- The tool MUST verify the message is addressed to a contact owned by the
  calling account before deleting; messages belonging to other accounts MUST
  return a structured not-found error (without distinguishing "not yours" from
  "does not exist").
- Deletion MUST remove the message record and all associated index entries
  atomically.
- After deletion the message MUST NOT be returned by `list_messages` or
  `get_message`.
- Deletion MUST NOT affect the associated contact, its credentials, or any other
  messages from the same sender.
- The tool returns a confirmation object containing `envelope_id` and
  `deleted: true`.
- If no message with the given `envelope_id` exists for the calling account, the
  tool MUST return a structured not-found error.
