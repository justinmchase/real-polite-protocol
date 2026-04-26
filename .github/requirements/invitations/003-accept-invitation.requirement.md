---
id: invitations-003
title: Listeners can accept a pending invitation
---

# Accept Invitation

The MCP server MUST expose `accept_invitation` so an authenticated listener can
accept a pending invitation and issue receipts to the inviting domain (Section
10B.4, Section 9.2, Section 9.3, Section 9.7, Section 6.1).

## Expected behavior

- The tool is available to any authenticated account.
- The tool accepts an invitation identifier and may accept optional negotiated
  terms.
- The tool MAY accept an optional `reason` field — a free-form short string
  attached to the receipt callback for the inviting domain's reference (Section
  9.7.2).
- Accepting an invitation transitions its local state from `pending` to
  `accepted` once the receipt callback has been successfully delivered to the
  inviting domain (see receipt-callback delivery requirement,
  `invitations-007`).
- Acceptance MAY use narrower terms than proposed, following Section 9.3.
- If multiple categories are accepted, the server issues one receipt per
  accepted category, consistent with Section 6.1.
- The resulting receipt terms granted by the listener are authoritative.
- The server MUST construct a `category: "receipt"` envelope per Section 9.7.2
  and POST it to the inviting domain's envelope endpoint, signed with the
  original invitation's `delivery.token`.
- The tool returns the acceptance outcome and issued receipt details.
