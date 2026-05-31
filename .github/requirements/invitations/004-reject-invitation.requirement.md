---
id: invitations-004
title: Listeners can reject a pending invitation
spec_ref: "10.2, 10.5, 12.2"
---

# Reject Invitation

The MCP server MUST expose `reject_invitation` so an authenticated local user
can decline a pending invitation (§10.2, §10.5, §12.2).

## Expected behavior

- The tool is available to any authenticated account.
- The tool accepts an `invitation_id`.
- The invitation MUST be in `pending` state. Rejection of a non-pending
  invitation MUST return `E_INVITATION_NOT_PENDING`.
- Rejection MUST transition the invitation to `rejected` locally.
- Rejection MUST NOT create a contact record.
- Rejection MUST NOT dispatch any outbound envelope to the remote sender.
  Silence is the protocol-level rejection signal (§10.5). The remote sender will
  simply observe no `invitation_reply`.
- The tool returns the updated invitation record (now `rejected`).

## Out of scope

- Acceptance — see `req:invitations-003`.
- Blocking the remote sender (a separate, contact-scoped action that requires a
  contact to exist first) — see `req:contacts-008`.
