---
id: invitations-001
title: Listeners can list inbound invitations
spec_ref: "10.2, 12.2"
---

# List Invitations

The MCP server MUST expose `list_invitations` so an authenticated local user can
list inbound invitations across all lifecycle states (§10.2, §12.2).

## Expected behavior

- The tool is available to any authenticated account.
- The tool returns invitations addressed to the calling user only — inbound
  invitations whose resolved receptive policy belongs to the caller.
- The tool MUST include invitations in lifecycle states `pending`, `accepted`,
  `rejected`, `expired`, and `cancelled` (§10.2).
- The tool supports filtering by `sender_domain`.
- The tool supports filtering by `status`.
- Each returned invitation includes sufficient summary fields for follow-up
  actions: `invitation_id`, `sender_domain`, `sender_display_name`, `status`,
  `sent_at`, `expires_at`, and `communication_terms`.

## Out of scope

- Outbound invitations the local user has sent — see
  `req:invitations-list-sent-invitations`.
- Acceptance, rejection, and cancellation — see `req:invitations-003`,
  `req:invitations-004`, `req:invitations-009`.
