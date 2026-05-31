---
id: receptive-policy-004
title: Contact-based receptive policy
spec_ref: "9.4"
---

## Requirement

A local user MAY create a receptive policy with `mode: "contact"` that accepts
invitations only from senders whose composite `(sender_domain, domain_id)` pair
appears in the policy's `contacts` list (§9.4).

## Rules

1. The policy MUST include `contacts`: a non-empty array of objects each
   containing `domain` (hostname) and `domain_id` (UUID).
2. When an invitation arrives referencing this policy, the server MUST:
   - Extract `sender_domain` from the invitation envelope.
   - Extract `domain_id` from `claims.immutable.domain_id`.
3. Admission passes only if the composite pair `(sender_domain, domain_id)`
   matches an entry in `contacts`. Matching MUST be exact on `domain_id` and
   case-insensitive on `domain`.
4. If either value is missing or the pair is not listed, reject with
   `E_RECEPTIVE_POLICY_CLOSED` (§13).
5. A `domain_id` alone (without its issuing `domain`) is insufficient for a
   match. Two different domains that issue the same UUID are different contacts.
6. Contact policies do not expire unless a `receptive_until` is also set (§9.6).
7. The `add_receptive_policy` MCP tool MUST accept `mode: "contact"` with a
   `contacts` parameter (array of `{domain, domain_id}` objects).
8. The `contacts` list is immutable after creation. To add or remove an entry,
   the caller MUST delete the policy and create a new one with the revised list.
   The replacement policy receives a new `policy_id`; callers are responsible
   for distributing the new `policy_id` to affected senders.
