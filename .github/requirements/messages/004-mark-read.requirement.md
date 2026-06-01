---
id: messages-004
title: Listeners can mark messages as read
spec_ref: "12.4"
---

# Mark Read

The MCP server MUST expose `mark_read` so an authenticated local user can mark
one or more messages in their inbox as read (§12.4).

## Expected behavior

- The tool is available to any authenticated account.
- The tool accepts `envelope_ids`: an array of one or more `envelope_id` values.
- The tool MUST only update messages addressed to a contact owned by the calling
  account. Messages belonging to other accounts MUST be silently ignored
  (treated as not-found from the caller's perspective) and MUST NOT appear in
  the success summary.
- For each owned message in the input list, the server MUST set the message's
  `read` flag to `true` and record a `read_at` timestamp set to the server time
  of the call. Already-read messages MUST remain `read: true`; the `read_at`
  timestamp MUST NOT be updated for messages that were already read.
- The tool MUST be idempotent: calling it twice with the same input produces the
  same end state.
- The tool returns:
  - `marked`: the array of `envelope_id` values transitioned from unread to
    read.
  - `already_read`: the array of `envelope_id` values that were already read.
  - `not_found`: the array of input `envelope_id` values that did not match any
    message owned by the caller.
