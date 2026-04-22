---
id: receipts-003
title: Listeners can revoke an issued receipt
---

# Revoke Receipt

The MCP server MUST expose `revoke_receipt` so an authenticated listener can
immediately revoke any receipt they have issued (Section 10A.1, Section 10B.3).

## Expected behavior

- The tool is available to any authenticated account.
- The tool requires `receipt_id` and a structured `reason` from the set
  `SENDER_REQUEST`, `CATEGORY_VIOLATION`, `RATING_VIOLATION`, `SPAM`, `ABUSE`,
  `OTHER`.
- An optional `reason_detail` string may be provided for additional context.
- Revocation is immediate: the receipt status becomes `revoked` and the
  `revoked_at` timestamp is set.
- After revocation, any submit request using the revoked receipt MUST be
  rejected with HTTP 403 and error code `E_RECEIPT_REVOKED`.
- Attempting to revoke a receipt that belongs to a different account MUST be
  rejected with `E_RECEIPT_NOT_OWNED`.
- Attempting to revoke an already-revoked receipt MUST be rejected with
  `E_RECEIPT_ALREADY_REVOKED`.
- The tool returns the updated receipt record including `revoked_at` and
  `revocation_reason`.
