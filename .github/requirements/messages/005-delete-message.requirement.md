---
id: messages-005
title: Listeners can delete a message from their local store
spec_ref: "10B.1"
---

# Delete Message

The MCP server MUST expose `delete_message` so an authenticated listener can
permanently remove a message from their local inbox (Section 10B.1).

Deletion is local-only: the sender's copy of the message is unaffected, and no
notification is sent to the sender.

## Expected behavior

- The tool is available to any authenticated account.
- The tool requires `message_id`.
- The tool MUST verify that the message's receiving receipt was issued by the
  calling account before deleting; messages belonging to other accounts MUST
  return a structured not-found error (without distinguishing "not yours" from
  "does not exist").
- Deletion MUST remove the message record and all associated index entries
  atomically.
- After deletion the message MUST NOT be returned by `list_messages` or
  `get_message`.
- Deletion MUST NOT revoke or otherwise affect any receipt referenced by the
  message (including `reply_invite`).
- The tool returns a confirmation object containing `message_id` and
  `deleted: true`.
- If no message with the given `message_id` exists for the calling account, the
  tool MUST return a structured not-found error.

## Out of scope

- Notifying the sender of deletion.
- Bulk deletion (no `bulk_delete_messages` tool in this RFC version).
- Soft-delete or trash-folder semantics.
