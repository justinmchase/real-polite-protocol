---
id: invitations-008
title: Servers handle inbound invitation_reply envelopes
spec_ref: "10.4, 11.1, 11.2"
---

# Inbound Invitation Reply Handling

When the envelope endpoint receives an `invitation_reply` envelope (§10.4), the
server MUST process it as the remote's confirmation of acceptance for an
invitation the local user previously sent. Successful processing establishes a
bilateral contact (§11.1) and transitions the outbound invitation record to
`accepted` (`req:invitations-007`).

## Inbound validation

The category-specific validation rules at `req:submit-004` apply: the envelope
MUST include `invitation_id`, `communication_terms`,
`reply_credential = (contact_id, contact_secret)`, and
`claims.immutable.domain_id`. The HMAC scheme at `req:submit-002` applies
unchanged: the `x-rpp-contact-id` header MUST name the locally persisted
outbound `reply_credential` written when the original `send_invitation` (or
`invite_contact`) call was made, and the HMAC key is that credential's
`contact_secret`.

## Server steps on accept

1. Look up the outbound invitation record by `invitation_id` for the OID that
   owns the resolved `x-rpp-contact-id`. If no matching record exists, reject
   with `E_INVITATION_NOT_FOUND` (§13). If the outbound record is not in
   `pending`, reject with `E_INVITATION_NOT_PENDING` (§13).
2. Verify the inbound `sender_domain` matches the outbound record's
   `receiver_domain`. Otherwise reject with `E_SENDER_DOMAIN_MISMATCH` (§13).
3. Upsert a local contact (`req:contacts-001`) keyed by
   `(owner_oid, sender_domain, claims.immutable.domain_id)`:
   - Promote the locally persisted outbound `reply_credential` to the contact's
     `local_credential` (the credential the remote will use for **inbound** to
     us). Retire the outbound reply_credential record.
   - Store the envelope's `reply_credential` as `remote_credential` (the
     credential the local domain will use for **outbound** to the remote).
   - Store the envelope's `communication_terms` as `remote_terms`.
   - Store the outbound invitation's `communication_terms` (what the local user
     committed to at send time) as `local_terms`.
   - Accumulate claims into the contact's `fields` history per
     `req:contacts-002`.
4. Transition the outbound invitation record to `accepted` and record the
   resulting `contact_id` on it.
5. Respond with HTTP 202 and the uniform acknowledgement at `req:submit-001`.

## Optional verification

If the envelope carries a `verification` block (§10.7), the server SHOULD
attempt verification against the remote's JWKS and surface the resulting status
(`verified` / `unverified` / `signature_mismatch` / `key_not_found`) on the
resulting contact record. Verification failure MUST NOT cause the envelope to be
rejected — verification is informational.

## Replay and idempotency

- A repeat `invitation_reply` for the same outbound `invitation_id` whose
  reply_credential has already been consumed MUST be rejected with
  `E_INVITATION_NOT_PENDING`.
- A duplicate envelope (same `envelope_id`) MUST be rejected with
  `E_DUPLICATE_ENVELOPE` per `req:submit-003`.
