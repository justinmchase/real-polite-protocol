---
id: receptive-policy-001
title: Listeners can list their receptive policies
---

# Get Receptive Policies

The MCP server MUST expose `get_receptive_policies` to allow authenticated
listeners to retrieve their current receptive policy records (Section 9.1).

## Expected behavior

- The tool is available to any authenticated account.
- The tool returns a paged list of the listener's receptive policies.
- If the listener has no policies, the result is an empty list. No policies
  implies the listener is not receptive (default `closed` behavior).
- Each policy record includes a `policy_id`, `mode`, optional `domain_filter`,
  optional `receptive_until`, and `created_at`.
- The `page_size` parameter limits result count (default 50, max 100).
