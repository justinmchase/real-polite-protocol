---
id: receptive-policy-001
title: Listeners can retrieve their current receptive policy
---

# Get Receptive Policy

The MCP server MUST expose `get_receptive_policy` to allow authenticated
listeners to retrieve their current receptive policy configuration (Section
9.1).

## Expected behavior

- The tool is available to any authenticated account.
- The tool returns the listener's current receptive policy.
- The returned policy reflects the active mode: `all`, `domain_filter`, or
  `closed`.
- If the listener has a time-bounded window active (Section 9.1.1), the
  response MUST include `receptive_until` and the window's `scope`.
- If no policy has been explicitly set, the default state is `closed` — the
  server MUST NOT allow invitations unless the listener has opted in.
