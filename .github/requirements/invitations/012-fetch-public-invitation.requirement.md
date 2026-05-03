---
id: invitations-012
title: Listeners can fetch a remote public invitation by domain and invitation ID
spec_ref: "9.4.1, 9.4.2, 10B.4"
---

# Fetch Public Invitation

The MCP server MUST expose `fetch_public_invitation` so an authenticated
listener can retrieve a public invitation from a remote (or local) RPP domain by
`domain` and `invitation_id` (Section 9.4.2, 10B.4).

## Expected behavior

- The tool is available to any authenticated account.
- The tool requires `domain` and `invitation_id`.
- The server fetches the public invitation from the hosting domain's unauthenticated
  endpoint (`GET /rpp/v1/invitations/{invitation_id}`); the request MUST NOT
  include the caller's credentials to the remote server.
- The tool returns the full public invitation object, including any
  `verification` attestation if present (Section 9.5).
- If the remote invitation does not exist or the hosting domain is unreachable,
  the tool MUST surface a structured error to the caller.
- The returned object MUST include at minimum: `invitation_id`, `domain`,
  `proposed_terms`, and `created_at`.
