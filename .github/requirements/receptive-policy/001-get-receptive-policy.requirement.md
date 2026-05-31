---
id: receptive-policy-001
title: Listeners can list their receptive policies
spec_ref: "9, 12.5"
---

# Get Receptive Policies

The MCP server MUST expose `get_receptive_policies` to allow authenticated local
users to retrieve their current receptive policy records (§9, §12.5).

## Expected behavior

- The tool is available to any authenticated account.
- The tool returns a paginated list of the calling user's receptive policies.
- If the user has no policies, the result is an empty list. No policies implies
  the user is not receptive (default `closed` behavior, §9.1).
- Each policy record includes a `policy_id`, `mode` (one of `all`,
  `domain_filter`, `contact`, `closed` — §9.2), optional `domain_filter` (§9.3),
  optional `contacts` (§9.4), optional `receptive_until` (§9.6), and
  `created_at`.
- The `page_size` parameter limits result count (default 50, max 100).
