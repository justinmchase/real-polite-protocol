---
id: messages-009
title: Listeners can read messages and have them marked as read automatically
spec_ref: "7, 12.4, 12.8"
---

# Read Messages

The MCP server MUST expose `read_messages` so an authenticated local user can
fetch a page of received messages and have all returned messages atomically
marked as read in the same operation (§12.4).

## Expected behavior

- The tool is available to any authenticated account.
- The tool accepts the same filter and pagination parameters as `list_messages`
  (`req:messages-002`): `category`, `contact_id`, `remote_domain`,
  `received_after`, `received_before`, `read`, `page_size`, and `resume_token`.
- The tool returns the same response shape as `list_messages`.
- The tool returns only messages addressed to a contact owned by the calling
  account (by OID). Messages addressed to other accounts MUST NOT be visible.
- After retrieving the result page, the tool MUST mark every **unread** message
  in that page as read. Already-read messages are unaffected.
- Every returned message MUST have `read: true` in the response.
- The `read_at` field of each returned message MUST be:
  - The message's original `read_at` if it was already read before the call.
  - A server-generated timestamp (at or after the call time) if the message was
    newly marked read by this call.
- The marking operation MUST be scoped to the calling account's OID; messages
  owned by other accounts MUST NOT be affected.
- The mark-as-read step MUST complete before the response is returned. Partial
  marking (some messages read, others not) MUST NOT occur within a single call.
- Results MUST be ordered by `received_at` descending by default.
- Results MUST be paginated via resume-token pagination (§12.8).
