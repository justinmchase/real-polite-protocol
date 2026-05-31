---
id: contacts-008
title: block_contact tool
spec_ref: "11.4, 12.3"
---

## Requirement

The MCP server MUST expose a `block_contact` MCP tool that marks an existing
contact as `blocked` for the authenticated local user (§11.4, §12.3).

Blocking is the soft form of severing a relationship: the credential pair is
retained on disk, but both directions of envelope flow are suppressed until the
contact is unblocked (`req:contacts-009`).

## Rules

1. Takes `contact_id`.
2. The contact MUST belong to the authenticated account. Unknown or foreign
   contacts return a structured not-found error.
3. Sets `contact.blocked = true` and refreshes `updated_at`. The
   `local_credential` and `remote_credential` records are NOT modified or
   deleted.
4. While `blocked`:
   - Inbound envelopes authenticated by this contact's `local_credential` MUST
     be rejected with `E_CONTACT_BLOCKED` (§13). This applies to both `message`
     and `invitation_reply` kinds.
   - `send_message` (`req:messages-001`) and `invite_contact`
     (`req:contacts-006`) MUST refuse locally with `E_CONTACT_BLOCKED` before
     any outbound HTTP request is made.
5. The block is purely local: no notification is dispatched to the remote.
6. Returns the updated contact record (with `blocked: true`).
