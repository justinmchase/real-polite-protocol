---
id: receptive-policy-005
title: Receipt-based receptive policy (auto-creation and re-invitation)
spec_ref: "9.1.6"
---

## Requirement

When a receipt is issued, the server SHOULD automatically create a
`mode: "receipt"` receptive policy for that receipt, allowing the sender to
re-invite without requiring a new receptive window.

## Rules

1. On invitation acceptance, after the receipt is issued, the server MUST create
   a `mode: "receipt"` policy with `receipt_id` set to the new receipt's ID,
   owned by the receiver's OID.
2. A sender MAY send an invitation with `receipt_id` in the envelope in lieu of
   `receptive_policy_id`. Exactly one of `receptive_policy_id` or `receipt_id`
   MUST be present in the invitation envelope.
3. When the submit endpoint receives an invitation with `receipt_id`: a. Look up
   the receipt; if not found or not active → reject `E_RECEIPT_NOT_ACTIVE`.
   b. Verify a `mode: "receipt"` policy for this `receipt_id` exists on
   `receipt.oid` → if not, reject `E_RECEPTIVE_POLICY_NOT_FOUND`. c.
   Create the invitation as `pending` on `receipt.oid`.
4. When a receipt is revoked (any reason including `SUPERSEDED`), all
   `mode: "receipt"` policies for that `receipt_id` MUST be deleted.
5. A deleted receipt policy MUST NOT pass the receptivity check.
