---
id: contacts-005
title: delete_contact tool
spec_ref: "11.4, 12.3"
---

## Requirement

The server MUST expose a `delete_contact` MCP tool that permanently removes a
contact record owned by the authenticated account (§11.4, §12.3).

Deletion is the hard form of severing the relationship: both directions of
envelope flow stop, and prior message history with this contact is purged. Where
the local user wants to stop receiving but keep history, they should use
`block_contact` (`req:contacts-008`) instead.

## Rules

1. Takes `contact_id`.
2. Atomically removes the contact record, its field history, its
   `local_credential` (so the remote can no longer authenticate inbound to this
   domain), and its `remote_credential` (so this domain cannot send outbound to
   it).
3. All inbound messages from this contact stored under the calling account MUST
   be removed.
4. After deletion, any further inbound envelope presenting the freed
   `local_credential.contact_id` MUST be rejected with `E_CONTACT_NOT_FOUND`
   (§13).
5. Returns a confirmation object with `contact_id` and `deleted: true`.
6. If the contact does not exist, return a structured not-found error.
