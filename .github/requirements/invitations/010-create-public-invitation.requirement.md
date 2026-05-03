---
id: invitations-010
title: Listeners can create a public invitation
spec_ref: "9.4, 9.4.1, 10B.4"
---

# Create Public Invitation

The MCP server MUST expose `create_public_invitation` so an authenticated
listener can create a standing public invitation that can be discovered and
accepted by anyone who obtains the invitation ID (Section 9.4).

## Required fields

A public invitation MUST include `proposed_terms`. The server MUST generate and
assign a unique `invitation_id`, `domain`, and `created_at` timestamp.

## Optional fields

The caller MAY supply:

- `display_name` — any Unicode string for human presentation.
- `description` — freeform text describing the invitation's purpose.
- `expires_at` — ISO 8601 timestamp after which the invitation is no longer
  valid.
- `max_acceptances` — maximum number of times the invitation can be accepted; if
  omitted, unlimited.
- `domain_filter` — domain filter restricting who may accept (Section 9.1.4).

## Expected behavior

- The tool is available to any authenticated account.
- The server MUST return the new `invitation_id` and `created_at` on success.
- `display_name` and `description` MUST NOT be used for routing or
  authentication — they are for human consumption only.
- `proposed_terms` MUST NOT be mutated after creation; to offer different terms
  the creator MUST create a new public invitation.
- The public invitation MUST be fetchable (unauthenticated) by invitation ID
  from the server after creation (Section 9.4.2).
