---
id: receptive-policy-002
title: Listeners can add a receptive policy
spec_ref: "9, 9.2, 12.5"
---

# Add Receptive Policy

The MCP server MUST expose `add_receptive_policy` to allow authenticated local
users to add a new receptive policy for incoming invitations (§9, §12.5).

## Expected behavior

- The tool is available to any authenticated account.
- Calling the tool creates a new policy record with a unique `policy_id` (UUID)
  and stacks it alongside any existing policies. All policies for the user are
  evaluated when an invitation arrives (§9.1).
- The tool accepts a `mode` field. The only valid values are the four modes in
  §9.2:
  - `all` — the user accepts invitations from any sender.
  - `domain_filter` — the user accepts invitations only from senders whose
    domain matches the provided filter rules (§9.3).
  - `contact` — the user accepts invitations only from senders whose
    `(remote_domain, remote_domain_id)` pair is in the provided contacts list
    (§9.4).
  - `closed` — explicitly rejects all senders; delivery via this policy always
    returns `E_RECEPTIVE_POLICY_CLOSED` (§9.2, §13).
- When `mode` is `domain_filter`, the tool MUST also accept a `domain_filter`
  object containing an ordered list of `allow`/`block` rules with glob patterns
  (§9.3).
- When `mode` is `contact`, the tool MUST also accept a `contacts` array of
  `(domain, domain_id)` pairs (§9.4).
- Adding a policy does NOT remove existing policies.
- The tool returns the newly created policy including its `policy_id`.
