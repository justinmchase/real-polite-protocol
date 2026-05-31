---
id: receptive-policy-006
title: Listeners can remove a receptive policy
spec_ref: "9, 12.5"
---

## Requirement

The server MUST expose a `remove_receptive_policy` MCP tool that permanently
deletes a receptive policy owned by the authenticated account (§9, §12.5).

This is the mechanism by which a local user revokes a receptive window early or
removes a standing policy they no longer wish to honour. After removal, any
invitation referencing the deleted `policy_id` MUST be rejected with
`E_RECEPTIVE_POLICY_NOT_FOUND` (§13).

## Rules

1. Takes `policy_id` (UUID).
2. The policy MUST belong to the authenticated account. If the policy does not
   exist or belongs to a different account, return a structured not-found error.
3. Removes the policy record and all its KV index entries (including any
   shortcode, `req:receptive-policy-007`) atomically.
4. Removing a receptive policy does NOT affect any existing contacts established
   through that policy — contacts have their own credentials independent of the
   policy that produced the first invitation (`req:contacts-001`).
5. Returns a confirmation object containing `policy_id` and `deleted: true`.
6. After removal the policy MUST no longer appear in `get_receptive_policies`.
