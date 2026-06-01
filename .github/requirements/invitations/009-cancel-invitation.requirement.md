---
id: invitations-009
title: Senders can cancel a direct invitation they have sent
spec_ref: "10.2"
---

# Cancel Invitation

The MCP server MUST expose `cancel_invitation` so an authenticated local sender
can cancel an outbound invitation they originated, transitioning its local
sent-state to `cancelled` (§10.2).

## Expected behavior

- The tool requires `invitation_id`.
- Only the originating sender (identified by OID on the outbound record) MAY
  cancel the invitation. Attempts by any other account MUST return a structured
  not-found error (the server MUST NOT distinguish "not yours" from "does not
  exist").
- The tool MUST accept cancellation of outbound invitations in `pending` state.
  Cancellation of an invitation in any terminal state (`accepted`, `rejected`,
  `expired`, `cancelled`) MUST return a structured error indicating the
  invitation cannot be cancelled in its current state.
- On success:
  - The outbound invitation status MUST be set to `cancelled`.
  - The locally persisted `reply_credential` for that invitation MUST be
    invalidated so any late inbound `invitation_reply` envelope referencing that
    credential is rejected.
- The tool MUST return the updated outbound invitation record including the new
  `cancelled` status.

## Receiver notification

The protocol does not require notifying the remote of cancellation. If the
remote later attempts to accept, the resulting `invitation_reply` will fail HMAC
verification (credential invalidated) and the local server MUST return a
structured error. For a remote whose acceptance arrives in flight, the local
server MUST treat it as a cancellation race and return an error without creating
a contact.

## Out of scope

- Cancelling an already-accepted contact relationship — use `delete_contact`
  (`req:contacts-005`) or `block_contact` (`req:contacts-008`).
- Reopening a cancelled invitation (create a new one instead).
