---
id: invitations-001
title: Listeners can list their invitations
---

# List Invitations

The MCP server MUST expose `list_invitations` so an authenticated listener can
list invitations they have received across lifecycle states (Section 10B.4,
Section 9.2).

## Expected behavior

- The tool is available to any authenticated account.
- The tool returns invitations for the calling listener only.
- The tool includes invitations in lifecycle states `pending`, `accepted`,
  `rejected`, and `expired`.
- The tool supports filtering by sender domain.
- The tool supports filtering by invitation status.
- Each returned invitation includes sufficient summary fields for follow-up
  actions such as review, accept, or reject (for example invitation id, sender
  domain, status, and expiry information).
