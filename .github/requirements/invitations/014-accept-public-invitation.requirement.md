---
id: invitations-014
title: Listeners can accept a remote public invitation
spec_ref: "9.4.3, 9.2, 10B.4"
---

# Accept Public Invitation

The MCP server MUST expose `accept_public_invitation` so an authenticated
listener can accept a public invitation hosted on a remote (or local) RPP domain
(Section 9.4.3).

## Expected behavior

- The tool is available to any authenticated account.
- The tool requires `domain` and `invitation_id` to identify the target
  invitation.
- The caller MAY supply `negotiated_terms` to accept narrower terms than the
  invitation's `proposed_terms` (Section 9.3).
- The caller MAY supply a voluntary `display_name` to attach to the acceptance,
  which is recorded on the receipt for the invitation creator's reference.

## Server-side enforcement (hosting domain)

When the hosting domain receives an acceptance:

1. The `domain_filter` on the public invitation, if present, MUST be evaluated
   against the acceptor's domain. If the domain does not match an `allow` rule,
   the acceptance MUST be rejected with `E_RECEPTIVE_POLICY_CLOSED` (Section
   11.2).
2. If `max_acceptances` is set, the server MUST enforce the limit. Once reached,
   further acceptances MUST be rejected.
3. The server MUST issue a receipt to the accepting party's domain.
4. Public invitation acceptance is subject to the standard invitation lifecycle
   (Section 9.2).

## Expected outcomes

- On success, the tool returns a receipt enabling future communication.
- If the invitation does not exist, has expired, or has reached `max_acceptances`,
  the tool MUST surface a structured error to the caller.
