---
id: invitations-002
title: Listeners can review a pending invitation
---

# Review Invitation

The MCP server MUST expose `review_invitation` so an authenticated listener can
retrieve the full details of a pending invitation before deciding whether to
accept or reject it (Section 10B.4, Section 9.2, Section 9.3).

## Expected behavior

- The tool is available to any authenticated account.
- The tool accepts an invitation identifier.
- The tool returns full invitation details for the caller, including proposed
  terms and expiry.
- The tool is intended for pending invitations that are awaiting a decision.
- The returned data is sufficient for the listener to evaluate and optionally
  negotiate narrower terms under Section 9.3.
