---
id: receptive-policy-003
title: Listeners can open a time-bounded receptive window
---

# Open Receptive Window

The MCP server MUST expose `open_receptive_window` to allow authenticated
listeners to create a time-bounded receptive policy (Section 9.1.1). This is the
RECOMMENDED mechanism for proximity pairing and in-person invitation exchanges.

## Expected behavior

- The tool is available to any authenticated account.
- The tool creates a new policy record with a unique `policy_id`, a
  `receptive_until` timestamp, and the specified scope.
- The new window policy STACKS alongside any existing policies — it does not
  replace them.
- The tool accepts a `duration_seconds` parameter specifying how long the window
  should remain open.
- The tool accepts an optional `scope` specifying the receptivity filter during
  the window. Valid values: `all` or `domain_filter`. Defaults to `all`.
- When `scope` is `domain_filter`, the tool MUST accept a `domain_filter`
  object.
- The server MUST compute `receptive_until` as the current server time plus the
  requested duration.
- After `receptive_until` has passed, the policy is no longer active and
  invitation delivery using its `policy_id` MUST be rejected with
  `INVITATION_NOT_RECEPTIVE`.
- The tool returns the newly created policy including `policy_id`,
  `receptive_until`, and `mode` (the window scope).
