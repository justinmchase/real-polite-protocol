---
id: receptive-policy-002
title: Listeners can add a receptive policy
---

# Add Receptive Policy

The MCP server MUST expose `add_receptive_policy` to allow authenticated
listeners to add a new receptive policy for incoming invitations (Section 9.1).

## Expected behavior

- The tool is available to any authenticated account.
- Calling the tool creates a new policy record with a unique `policy_id` (UUID)
  and stacks it alongside any existing policies.
- The tool accepts a `mode` field specifying one of the following receptive
  modes:
  - `all` — the listener accepts invitations from any sender.
  - `domain_filter` — the listener accepts invitations only from senders whose
    domain matches the provided filter rules (Section 9.1.4).
  - `closed` — explicitly closed (no invitations via this policy ID).
- When `mode` is `domain_filter`, the tool MUST also accept a `domain_filter`
  object containing an ordered list of `allow`/`block` rules with glob patterns.
- Adding a policy does NOT remove existing policies. All policies for the user
  are evaluated when an invitation arrives.
- The tool returns the newly created policy including its `policy_id`.
