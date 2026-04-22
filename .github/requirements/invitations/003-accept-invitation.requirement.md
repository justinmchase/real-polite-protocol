---
id: invitations-003
title: Listeners can accept a pending invitation
---

# Accept Invitation

The MCP server MUST expose `accept_invitation` so an authenticated listener can
accept a pending invitation and issue receipts to the inviting domain (Section
10B.4, Section 9.2, Section 9.3, Section 6.1).

## Expected behavior

- The tool is available to any authenticated account.
- The tool accepts an invitation identifier and may accept optional negotiated
  terms.
- Accepting an invitation transitions its state from `pending` to `accepted`.
- Acceptance MAY use narrower terms than proposed, following Section 9.3.
- If multiple categories are accepted, the server issues one receipt per
  accepted category, consistent with Section 6.1.
- The resulting receipt terms granted by the listener are authoritative.
- The tool returns the acceptance outcome and issued receipt details.
