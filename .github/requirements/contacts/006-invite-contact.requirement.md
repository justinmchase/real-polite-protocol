---
id: contacts-006
title: invite_contact tool
spec_ref: "10B.11, 9.1.6"
---

## Requirement

The server MUST expose an `invite_contact` MCP tool that sends an invitation to
a known contact, resolving the receiver domain from the stored contact record.

The tool supports two addressing mechanisms, mirroring `send_invitation`
(Section 9.1.6):

- **Policy-based**: caller provides `receptive_policy_id` — used for first
  contact or when no active receipt exists.
- **Receipt-based**: caller provides `receipt_id` — used to re-invite an
  existing contact without requiring a new receptive window.

## Rules

1. Takes `contact_id`, `proposed_terms`, and optionally `receptive_policy_id`,
   `receipt_id`, `include_user_claims`, `include_admin_claims`, `custom_claims`,
   `expires_at`. Exactly one of `receptive_policy_id` or `receipt_id` MUST be
   provided; supplying both or neither is invalid.
2. Looks up the contact by `contact_id` for the authenticated account. If not
   found, return a structured error.
3. Uses `contact.domain` as `receiver_domain` and performs the same invitation
   flow as `send_invitation` (Section 10B.4), forwarding whichever identifier
   was supplied (`receptive_policy_id` or `receipt_id`) in the envelope.
4. Returns the same response shape as `send_invitation`.
5. If the delivery to the receiver's submit endpoint fails, return a structured
   error indicating the failure reason.
