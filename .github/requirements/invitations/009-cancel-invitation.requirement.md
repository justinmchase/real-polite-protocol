---
id: invitations-009
title: Senders can cancel a direct invitation they have sent
spec_ref: "9.1, 9.2"
---

# Cancel Invitation

The MCP server MUST expose `cancel_invitation` so an authenticated sender can
cancel a direct invitation they originated, transitioning it to `cancelled`
(Section 9.2).

## Expected behavior

- The tool requires `invitation_id`.
- Only the originating sender (identified by OID) MAY cancel the invitation.
  Attempts by any other account MUST return a structured not-found error (the
  server MUST NOT distinguish "not yours" from "does not exist").
- The tool MUST accept cancellation of invitations in `pending` OR `accepted`
  state (per the `pending`/`accepted` → `cancelled` transition in Section 9.2).
- If the invitation is already in a terminal state (`rejected`, `cancelled`,
  `expired`), the tool MUST return a structured error indicating the invitation
  cannot be cancelled in its current state.
- On success:
  - The invitation status MUST be set to `cancelled`.
  - All receipts derived from that invitation MUST be immediately invalidated
    (revoked with reason `SUPERSEDED`), per Section 9.2.
  - An optional `reason` string MAY be recorded for human reference but MUST NOT
    be used for routing or auth.
- The tool MUST return the updated invitation record including the new
  `cancelled` status.

## Receiver notification

The spec does not define a dedicated cancellation callback to the receiver's
server. When a previously `accepted` invitation is cancelled after a receipt has
been issued, the receipt revocation (above) serves as the implicit signal. For
`pending` invitations, no receiver notification is required: the receiver will
observe the cancellation when they attempt to accept and receive
`E_INVITATION_NOT_PENDING` (Section 9.7.3).

## Out of scope

- Public invitation cancellation (use `cancel_public_invitation`, Section
  9.4.4).
- Re-opening a cancelled invitation (create a new one instead).
