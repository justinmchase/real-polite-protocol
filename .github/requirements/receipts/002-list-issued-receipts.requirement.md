---
id: receipts-002
title: Listeners can list receipts they have issued
---

# List Issued Receipts

The MCP server MUST expose `list_issued_receipts` so an authenticated listener
can enumerate the receipts they have issued to other domains (Section 10B.3,
Section 10A.1).

## Expected behavior

- The tool is available to any authenticated account.
- The tool returns only receipts issued by the calling account (by OID).
- Each returned receipt includes `id`, `sender_domain`, `category`,
  `max_content_rating`, `usage_policy`, `status`, `issued_at`, and optionally
  `invitation_id`, `revoked_at`, `revocation_reason`, and `revocation_detail`.
- The tool supports filtering by `status` (active, revoked, expired).
- The tool supports filtering by `sender_domain`.
- Results are paginated via `page_size` (default 50, max 100).
- Receipts issued by other accounts are never visible to this caller.
