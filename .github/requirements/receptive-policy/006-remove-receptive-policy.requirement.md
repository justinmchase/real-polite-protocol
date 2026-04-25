---
id: receptive-policy-006
title: Listeners can remove a receptive policy
spec_ref: "9.1.1"
---

## Requirement

The server MUST expose a `remove_receptive_policy` MCP tool that permanently
deletes a receptive policy owned by the authenticated account (Section 9.1.1).

This is the mechanism by which a listener revokes a receptive window early or
removes a standing policy they no longer wish to honour. After removal, any
invitation referencing the deleted `policy_id` MUST be rejected with
`E_RECEPTIVE_POLICY_NOT_FOUND`.

## Rules

1. Takes `policy_id` (UUID).
2. The policy MUST belong to the authenticated account. If the policy does not
   exist or belongs to a different account, return a structured not-found error.
3. Removes the policy record and all its KV index entries atomically.
4. Removing a `mode: "receipt"` policy does NOT revoke the underlying receipt;
   it only removes the re-invitation path through that policy.
5. Returns a confirmation object containing `policy_id` and `deleted: true`.
6. After removal the policy MUST no longer appear in `get_receptive_policies`.
