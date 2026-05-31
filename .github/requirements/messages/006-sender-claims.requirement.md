---
id: messages-006
title: Message responses include all recorded claims from the sender contact
spec_ref: "11.2, 12.4"
---

# Sender Claims in Message Responses

The MCP server MUST include the current contact field values for the message
sender in the responses from both `list_messages` and `get_message` (§12.4).

## Background

A `message` envelope is only routable when a contact already exists for
`(sender_domain, claims.immutable.domain_id)` from a prior accepted invitation
or invitation_reply (§11.1). That contact's accumulated `fields` (§11.2)
represent everything the local domain currently knows about the sender.

## Expected behavior

- Both `list_messages` and `get_message` MUST include a `sender_claims` field in
  every returned message object.
- `sender_claims` MUST contain the current (flat-merged) `current_fields` of the
  contact identified by the message's `contact_id`.
- If the contact has been deleted (a rare race), `sender_claims` MUST be an
  empty object (`{}`); the field MUST still be present.
- The shape of each claim value MUST match the contact field value type: string,
  number, boolean, null, or a flat array of those.
- `sender_claims` MUST reflect the current contact fields at the time of the
  request, not the claims that were present when the message was originally
  delivered.
- `sender_claims` MUST include fields from ALL claim sources stored on the
  contact: `remote_custom`, `remote_verified`, `remote_admin`, and `owner_note`.
  No source is excluded.
