---
id: receipts-004
title: Receipt superseding on new acceptance
spec_ref: "6.6"
---

## Requirement

When a new receipt is issued as a result of accepting an invitation, the server
MUST revoke all existing **active** receipts on the same receiver account whose
`sender_domain_id` matches the new receipt's `sender_domain_id`.

## Rules

1. A receipt carries a `sender_domain_id` field equal to the `domain_id` value
   from `claims.immutable` on the accepted invitation. If the invitation has no
   `claims.immutable.domain_id` no superseding occurs.
2. Superseding is applied before the new receipt is stored (old receipts are
   revoked first).
3. Superseded receipts MUST have `status: "revoked"`, `revoked_at` set to the
   acceptance timestamp, and `revocation_reason: "SUPERSEDED"`.
4. After acceptance there MUST be exactly one active receipt for that
   `(receiver_oid, sender_domain_id)` pair.
5. Receipts that lack a `sender_domain_id` (legacy receipts) are NOT superseded.
