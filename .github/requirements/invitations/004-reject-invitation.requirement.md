---
id: invitations-004
title: Listeners can reject a pending invitation
---

# Reject Invitation

The MCP server MUST expose `reject_invitation` so an authenticated listener can
explicitly decline a pending invitation (Section 10B.4, Section 9.2).

## Expected behavior

- The tool is available to any authenticated account.
- The tool accepts an invitation identifier.
- Rejecting an invitation transitions its state from `pending` to `rejected`.
- Rejection MUST NOT issue any receipt.
- The tool returns the rejection outcome for the selected invitation.
