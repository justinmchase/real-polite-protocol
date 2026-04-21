---
id: receptive-policy-002
title: Listeners can update their receptive policy
---

# Set Receptive Policy

The MCP server MUST expose `set_receptive_policy` to allow authenticated
listeners to update their receptive policy for incoming invitations (Section
9.1).

## Expected behavior

- The tool is available to any authenticated account.
- The tool accepts a `mode` field specifying one of the following receptive
  modes:
  - `all` — the listener accepts invitations from any sender.
  - `domain_filter` — the listener accepts invitations only from senders whose
    domain matches the provided filter rules (Section 9.1.4).
  - `closed` — the listener is not receptive; all invitation delivery attempts
    MUST be rejected with `INVITATION_NOT_RECEPTIVE`.
- When `mode` is `domain_filter`, the tool MUST also accept a `domain_filter`
  object containing an ordered list of `allow`/`block` rules with glob
  patterns.
- Domain filter rules are evaluated top-to-bottom. The first matching rule
  wins. If no rule matches, the domain is implicitly blocked.
- An empty rules list is equivalent to `closed` (all domains are implicitly
  blocked).
- Setting a new policy MUST overwrite any previously active non-timed policy.
- Setting a policy MUST NOT cancel an active time-bounded window (Section
  9.1.1); the window's `receptive_until` governs until expiry.
- The tool returns the resulting policy after the update.
