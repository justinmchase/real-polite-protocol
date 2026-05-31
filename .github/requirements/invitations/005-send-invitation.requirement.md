---
id: invitations-005
title: Senders can send a direct invitation by receptive_policy_id
spec_ref: "10.3, 12.2"
---

# Send Invitation

The MCP server MUST expose `send_invitation` so an authenticated local user can
send a direct invitation to a remote domain identified by `receiver_domain` and
a `receptive_policy_id` shared out-of-band by that domain (§10.3, §12.2).

The remote's `receptive_policy_id` is the bearer credential authorizing inbound
to that policy window. The local server simply attaches the policy id, builds
the invitation envelope, and POSTs it to the remote — it does NOT validate the
remote policy. The remote's submit handler resolves the policy, checks
admission, and stores the invitation.

## Expected behavior

- The tool is available to any authenticated account.
- The tool requires:
  - `receiver_domain` — the remote's RPP domain.
  - `receptive_policy_id` — the policy id (or `shortcode`, see
    `req:receptive-policy-007`) the remote shared out-of-band.
  - `communication_terms` — the local user's declared willingness (categories
    drawn from §7.1 and `max_content_rating` from §7.2). These become the
    `communication_terms` field of the outbound envelope and, on accept by the
    remote, the `remote_terms` from the remote's perspective.
- The tool MAY accept `message`, `include_user_claims`, `include_admin_claims`,
  `custom_claims`, `verification`, and `expires_at` per §10.1 / §10.6 / §10.7.

## Server steps

1. Generate `invitation_id` (UUIDv7) and `reply_credential`:
   `(contact_id, contact_secret)` — a freshly generated identity pair with ≥128
   bits of entropy (§6.1, §10.1). The local server MUST persist this
   reply_credential locally so the future `invitation_reply` envelope from the
   remote can be HMAC-verified.
2. Compose the envelope per §10.1 with `category: "invitation"`, populate
   `claims.immutable.domain_id`, attach selected user/admin/custom claims
   (§10.6), and optionally include the `verification` block (§10.7).
3. POST the envelope to the remote's envelope endpoint with no identity header
   (the embedded `receptive_policy_id` is the credential).
4. Record an outbound (sent) invitation entry owned by the calling account in
   `pending` state.
5. On 2xx, return `{ invitation_id, sent_at }`. On non-2xx, surface the remote's
   structured error to the caller.

## Same-domain (local) dispatch

When `receiver_domain` equals the local domain, the envelope MUST be delivered
by calling the local invitation handler directly without an outbound HTTP
request (per `req:submit-005`). The reply_credential MUST still be generated and
persisted so the upcoming local `invitation_reply` remains authenticatable on
the same path.

## Out of scope

- Inviting via a known contact (use `invite_contact`, see `req:contacts-006`).
- The remote's acceptance / reply handling — see
  `req:invitations-invitation-reply`.
