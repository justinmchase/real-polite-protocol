---
id: contacts-009
title: unblock_contact tool
spec_ref: "11.4, 12.3"
---

## Requirement

The MCP server MUST expose an `unblock_contact` MCP tool that clears the
`blocked` flag on an existing contact owned by the authenticated local user
(§11.4, §12.3).

## Rules

1. Takes `contact_id`.
2. The contact MUST belong to the authenticated account. Unknown or foreign
   contacts return a structured not-found error.
3. Sets `contact.blocked = false` and refreshes `updated_at`. Credentials and
   field history are unchanged.
4. After unblocking, inbound envelopes authenticated by the contact's
   `local_credential` are admitted again subject to the normal rules (term
   enforcement `req:contacts-011`, envelope validation `req:submit-004`, etc.).
5. After unblocking, `send_message` and `invite_contact` to this contact succeed
   normally.
6. Calling `unblock_contact` on a contact that is already unblocked is a no-op
   (idempotent) and returns the contact record unchanged apart from a refreshed
   `updated_at`.
7. Returns the updated contact record (with `blocked: false`).
