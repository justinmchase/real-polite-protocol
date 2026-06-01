---
id: invitations-002
title: Listeners can review a pending invitation
spec_ref: "10.1, 10.6, 10.7, 12.2"
---

# Review Invitation

The MCP server MUST expose `review_invitation` so an authenticated local user
can retrieve the full details of a pending invitation before deciding whether to
accept or reject it (§10.1, §10.6, §10.7, §12.2).

## Expected behavior

- The tool is available to any authenticated account.
- The tool accepts an `invitation_id`.
- The tool returns the full inbound invitation as recorded by the local domain,
  including:
  - `invitation_id`, `sender_domain`, `sender_display_name`,
  - `sent_at`, `expires_at`, `status`,
  - `communication_terms` (the remote's declared willingness — categories +
    `max_content_rating`, see §10.1 and §11.5),
  - `claims` with all four namespaces (`immutable`, `user`, `admin`, `custom`)
    when present (§10.6),
  - `verification` block when present, along with a server-computed verification
    status (`verified` / `unverified` / `signature_mismatch` / `key_not_found`)
    per §10.7.4,
  - the optional human-readable `message` field.
- If no invitation with the given id exists for the calling account, the tool
  MUST return a structured not-found error.
- The tool MUST NOT expose the remote's `reply_credential` to the caller — that
  secret stays inside the server. Only the local domain needs it when
  dispatching the `invitation_reply` envelope.

## Out of scope

- Term negotiation: the local user simply supplies their own
  `communication_terms` at acceptance time (§10.4). See `req:invitations-003`.
- Outbound invitations the local user has sent — see
  `req:invitations-list-sent-invitations`.
