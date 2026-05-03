---
id: invitations-011
title: Listeners can list their own public invitations
spec_ref: "9.4, 10B.4"
---

# List Public Invitations

The MCP server MUST expose `list_public_invitations` so an authenticated
listener can list public invitations they have created (Section 10B.4).

## Expected behavior

- The tool is available to any authenticated account.
- The tool returns only public invitations belonging to the calling listener.
- The tool MUST support filtering by status (e.g. `active`, `cancelled`,
  `expired`).
- Each returned invitation MUST include at minimum: `invitation_id`, `domain`,
  `status`, `proposed_terms`, and `created_at`.
- The tool MUST support resume-token pagination (Section 10B.10).
