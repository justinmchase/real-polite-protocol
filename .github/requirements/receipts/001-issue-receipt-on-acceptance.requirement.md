---
id: receipts-001
title: Accepting an invitation issues and records a receipt
---

# Issue Receipt on Invitation Acceptance

When a listener accepts an invitation via the `accept_invitation` MCP tool, the
server MUST issue a receipt to the inviting domain and persist it (Section 9.3,
Section 9.7, Section 6.1).

## Expected behavior

- Calling `accept_invitation` on a pending invitation transitions the local
  invitation state to `accepted` once the receipt callback has been delivered to
  the inviting domain.
- The server generates a new receipt with a unique `id` and a randomly generated
  `secret` and stores it at the canonical KV path used by the envelope endpoint.
- The receipt captures the sender domain, the accepted category and content
  rating, and the source invitation ID.
- The receipt is initially in `active` status.
- The server MUST deliver the issued receipt back to the inviting domain via a
  `category: "receipt"` envelope (Section 9.7.2). See receipt-callback delivery
  requirement (`invitations-007`).
- The tool response includes the issued receipt credentials (`id`, `secret`,
  `category`, `max_content_rating`, `usage_policy`, `issued_at`) alongside the
  updated invitation fields.
- The issued receipt can be retrieved via the `list_issued_receipts` tool.
