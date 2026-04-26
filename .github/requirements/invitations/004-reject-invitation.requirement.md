---
id: invitations-004
title: Listeners can reject a pending invitation
---

# Reject Invitation

The MCP server MUST expose `reject_invitation` so an authenticated listener can
explicitly decline a pending invitation (Section 10B.4, Section 9.2, Section
9.7).

## Expected behavior

- The tool is available to any authenticated account.
- The tool accepts an invitation identifier.
- The tool MAY accept an optional `reason` field — a free-form short string
  attached to the receipt callback for the inviting domain's reference (Section
  9.7.2).
- Rejecting an invitation transitions its local state from `pending` to
  `rejected` once the rejection callback has been successfully delivered to the
  inviting domain (see receipt-callback delivery requirement,
  `invitations-007`).
- Rejection MUST NOT issue any receipt.
- The server MUST construct a `category: "receipt"` envelope with
  `decision: "rejected"` per Section 9.7.2 and POST it to the inviting domain's
  envelope endpoint, signed with the original invitation's `delivery.token`.
- The tool returns the rejection outcome for the selected invitation.
