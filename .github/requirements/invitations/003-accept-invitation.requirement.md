---
id: invitations-003
title: Listeners can accept a pending invitation
spec_ref: "10.2, 10.4, 11.2, 12.2"
---

# Accept Invitation

The MCP server MUST expose `accept_invitation` so an authenticated local user
can accept a pending invitation. Acceptance establishes a bilateral contact and
dispatches an `invitation_reply` envelope back to the remote sender's domain
(§10.4, §10.2, §11.2, §12.2).

## Expected behavior

- The tool is available to any authenticated account.
- The tool accepts:
  - `invitation_id` — REQUIRED.
  - `local_terms` — REQUIRED. The local user's own declared willingness
    (categories drawn from §7.1 message categories and `max_content_rating` from
    §7.2). These are stored as the contact's `local_terms` and sent to the
    remote in the `invitation_reply` envelope so the remote knows what the local
    user is willing to receive (§10.4, §11.5).
  - `message` — OPTIONAL human-readable introduction included in the reply
    envelope (§10.4).
- The invitation MUST be in `pending` state. Acceptance of a non-pending
  invitation MUST return `E_INVITATION_NOT_PENDING`.

## Server steps on accept

1. Create a local contact record (§11) using
   `(invitation.sender_domain, invitation.claims.immutable.domain_id)` as the
   composite identity key. The invitation's `communication_terms` are stored as
   the contact's `remote_terms`. The invitation's `reply_credential` becomes the
   contact's `remote_credential` (used for outbound). Claims are accumulated
   into the contact's `fields` history (§11.2).
2. Generate a fresh `local_credential` `(contact_id, contact_secret)` for the
   contact (≥128 bits of entropy). This is the credential the remote sender will
   use for inbound to the local domain.
3. Construct an `invitation_reply` envelope per §10.4 carrying the local user's
   `communication_terms` (the supplied `local_terms`), the new
   `reply_credential` (the local `local_credential`), the local user's
   `claims.immutable.domain_id`, and the optional `message`.
4. POST the `invitation_reply` envelope to the remote sender's envelope
   endpoint, signed via HMAC-SHA-256 (§6.1) using the inbound invitation's
   `reply_credential.contact_secret` as the key and
   `x-rpp-contact-id: <inbound reply_credential.contact_id>` as the identity
   header.
5. Transition the invitation to `accepted`.

## Same-domain (local) dispatch

When the remote sender's domain equals the local domain, the `invitation_reply`
envelope MUST be delivered by invoking the local handler directly without making
an outbound HTTP request (per `req:submit-005`). Observable result MUST be
identical to the remote HTTP path.

## Result

The tool returns the updated invitation record (now `accepted`) and the new
contact id.

## Out of scope

- Rejection — see `req:invitations-004`.
- Remote-side handling of the inbound `invitation_reply` — see
  `req:invitations-invitation-reply`.
