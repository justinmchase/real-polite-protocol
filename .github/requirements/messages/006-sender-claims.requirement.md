---
id: messages-006
title: Message responses include all recorded claims from the sender
---

# Sender Claims in Message Responses

The MCP server MUST include all recorded contact claims for the message sender
in the responses from both `list_messages` and `get_message`.

## Background

When an invitation is accepted, the receiver's server records any claims
attached to the invitation (e.g. custom claims set by the sender) as fields on
the resulting contact entry. Subsequent field updates may also add or overwrite
claims over time. This contact record represents the server's accumulated
knowledge about the sender.

## Expected behavior

- Both `list_messages` and `get_message` MUST include a `sender_claims` field in
  every returned message object.
- `sender_claims` MUST contain the current (flat-merged) fields recorded for the
  contact whose `sender_domain` and `sender_domain_id` match the message.
- If no contact record exists for the sender, `sender_claims` MUST be an empty
  object (`{}`); the field MUST still be present.
- The shape of each claim value MUST match the contact model's claim value type:
  string, number, boolean, null, or a flat array of those.
- `sender_claims` MUST reflect the current contact fields at the time of the
  request, not the claims that were present at the time the message was
  originally delivered.
- `sender_claims` MUST include fields from ALL claim sources stored on the
  contact: `sender_custom` (invitation custom claims), `sender_verified`
  (user-verified claims), `domain_admin` (admin-verified claims), and
  `owner_note` (fields set by the contact owner). No source is excluded.

## Out of scope

- Historical field values for the sender (use `get_contact` for full history).
