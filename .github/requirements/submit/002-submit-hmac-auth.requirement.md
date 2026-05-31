---
id: submit-002
title: Envelope requests are authenticated with per-contact HMAC signatures
spec_ref: "6.1, 10.1, 10.3"
---

# Envelope HMAC Authentication

The envelope endpoint MUST use HMAC-based, request-bound authentication (§6.1).
RPP v0.3 uses a single, uniform HMAC scheme keyed by a per-contact
`contact_secret`; the identity header is `x-rpp-contact-id` for every category
that carries a contact credential.

## Expected behavior

- Every HMAC-signed envelope request includes `x-rpp-signature` and
  `x-rpp-timestamp` headers (§6.1).
- The identity header rules per category are:
  - `message` envelopes: MUST include `x-rpp-contact-id`. The HMAC key is the
    `contact_secret` of the named local `contact.local_credential` — that is,
    the credential the local domain issued to the remote on accept. The sender
    domain MUST equal the contact's `remote_domain` (otherwise reject with
    `E_SENDER_DOMAIN_MISMATCH`, §13).
  - `invitation_reply` envelopes: MUST include `x-rpp-contact-id`. The HMAC key
    is the `contact_secret` of the locally persisted `reply_credential` that was
    generated when the local user originally sent the invitation (§10.4). The
    reply_credential is single-use; once consumed it is promoted to
    `contact.remote_credential` and the original reply_credential record is
    retired.
  - `invitation` envelopes addressing an open `receptive_policy_id` (§10.3) MAY
    be submitted with no identity header and no HMAC signature; the embedded
    `receptive_policy_id` itself acts as the bearer credential authorizing
    delivery into that policy window. If headers ARE present, they MUST be
    ignored — the policy id alone authorizes delivery.
- The server rejects requests with missing or malformed signature or timestamp
  headers using the corresponding §6.1 error codes.
- The server rejects requests that present an identity header in combination
  with an envelope category that does not accept one (or vice versa) with
  `E_INVALID_AUTH_HEADERS` (§13).
- The server resolves the HMAC key by looking up the record named by
  `x-rpp-contact-id`:
  - For `message`: looks up `contact.local_credential` and reads the associated
    `contact_secret`.
  - For `invitation_reply`: looks up the pending outbound `reply_credential` and
    reads its `contact_secret`.
- Unknown `x-rpp-contact-id` MUST be rejected with `E_CONTACT_NOT_FOUND` (§13)
  regardless of category. The server MUST NOT distinguish "unknown" from
  "belongs to another account" in the error response.
- If the named contact exists but is `blocked` (per `req:contacts-008`), the
  request MUST be rejected with `E_CONTACT_BLOCKED` (§13).
- The server computes the signature using HMAC-SHA-256 with the resolved key
  (§6.1).
- The HMAC input is the exact concatenation of the `x-rpp-timestamp` header
  value, a literal `.` character, and the raw request body bytes (§6.1).
- The presented signature is lowercase hexadecimal.
- If the computed HMAC does not match the presented signature, the server
  rejects the request with `E_INVALID_SIGNATURE` (§13).
- The envelope endpoint uses credential-based authorization failures with HTTP
  403, not HTTP 401.
