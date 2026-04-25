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
  - `contact` — the listener accepts invitations only from senders whose
    (domain, domain_id) pair is in the provided contacts list.
  - `closed` — explicitly rejects all senders; delivery via this policy always
    returns `E_RECEPTIVE_POLICY_CLOSED`.
- The `receipt` mode MUST NOT be accepted as input to this tool. Receipt-mode
  policies are auto-created by the server when an invitation is accepted (Section
  9.1.6) and are never user-createable. The output schema MAY include
  `mode: "receipt"` policies when listing existing policies, but the input for
  this tool is limited to `all`, `domain_filter`, `contact`, and `closed`.
- When `mode` is `domain_filter`, the tool MUST also accept a `domain_filter`
  object containing an ordered list of `allow`/`block` rules with glob patterns.
- When `mode` is `contact`, the tool MUST also accept a `contacts` array of
  (domain, domain_id) pairs.
- Adding a policy does NOT remove existing policies. All policies for the user
  are evaluated when an invitation arrives.
- The tool returns the newly created policy including its `policy_id`.
