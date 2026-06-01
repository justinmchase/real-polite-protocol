---
id: receptive-policy-007
title: Receptive windows expose a shareable shortcode
spec_ref: "9.6"
---

# Receptive Window Shortcode

When a local user opens a time-bounded receptive window via
`open_receptive_window` (§9.6, `req:receptive-policy-003`), the server MUST
generate a short, human-readable **shortcode** that the user can share with a
potential sender as an alternative to the full `policy_id` UUID.

## Shortcode format

- The shortcode MUST be exactly 8 characters drawn from the lowercase
  alphanumeric alphabet (`[a-z0-9]`), randomly generated.
- It MUST be unique at the time of creation (the server MUST retry generation on
  collision, up to a reasonable maximum).
- It is NOT guaranteed to be globally unique across all time — it is scoped to
  the lifetime of the window and becomes invalid once the policy is deleted or
  expires.

## Sharing

- The `open_receptive_window` tool response MUST include both `shortcode` and
  the server's `domain` so the agent can surface them to the local user.
- The MCP tool description MUST explicitly instruct the AI agent to present
  `shortcode` and `domain` to the local user in a clearly copyable form (e.g. a
  fenced code block or quoted string) immediately after the tool call completes.

## Sender usage

- A remote sender MAY use `shortcode` + `receiver_domain` as an alternative to
  `receptive_policy_id` when calling `send_invitation` (`req:invitations-005`).
- When a `shortcode` is provided, the server MUST resolve it to the underlying
  `policy_id` before applying all normal policy validation rules (expiry, mode,
  contact-filter, etc.).
- If the shortcode cannot be resolved (not found, already expired / deleted),
  the server MUST reject the invitation with `E_RECEPTIVE_POLICY_NOT_FOUND`
  (§13).

## Lifecycle

- The shortcode index entry MUST be written atomically with the policy record.
- When a receptive policy is deleted (via `remove_receptive_policy` or any
  expiry cleanup), the shortcode index entry MUST also be removed.
- After expiry, the shortcode resolves to an expired policy and the normal
  `E_RECEPTIVE_POLICY_EXPIRED` error applies.
