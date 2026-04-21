---
id: receptive-policy-003
title: Listeners can open a time-bounded receptive window
---

# Open Receptive Window

The MCP server MUST expose `open_receptive_window` to allow authenticated
listeners to create a time-bounded receptive window for incoming invitations
(Section 9.1.1). This is the RECOMMENDED mechanism for proximity pairing and
in-person invitation exchanges.

## Expected behavior

- The tool is available to any authenticated account.
- The tool accepts a `duration_seconds` (or equivalent duration parameter)
  specifying how long the window should remain open.
- The tool accepts an optional `scope` specifying the receptivity filter to
  apply during the window. Valid scope values follow the same modes as
  `set_receptive_policy`: `all` or `domain_filter`. A `closed` scope is not
  valid for a window.
- If `scope` is omitted, the window defaults to `all` — receptive to any
  sender during the window.
- The server MUST compute `receptive_until` as the current server time plus the
  requested duration and store it on the policy record.
- While `receptive_until` is in the future, invitation delivery MUST apply the
  window's `scope` filter rather than the base policy.
- Servers MUST reject invitations arriving after `receptive_until` with
  `INVITATION_NOT_RECEPTIVE` and revert to the base policy.
- Opening a new window replaces any currently active window (a new
  `receptive_until` is computed from the time of the call).
- The tool returns the resulting policy including `receptive_until` and
  `scope`.
