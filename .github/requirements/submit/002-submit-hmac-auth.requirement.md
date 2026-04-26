---
id: submit-002
title: Envelope requests are authenticated with HMAC signatures keyed by envelope kind
---

# Envelope HMAC Authentication

The envelope endpoint MUST use HMAC-based, request-bound authentication (Section
5.1). The HMAC algorithm and canonical input are uniform across envelope kinds;
only the **identity header** and the **HMAC key source** vary.

## Expected behavior

- Every HMAC-signed envelope request includes `x-rpp-signature` and
  `x-rpp-timestamp` headers.
- Every HMAC-signed envelope request includes exactly one of these identity
  headers, selected by envelope kind:
  - `x-rpp-receipt-id` for `message` envelopes and `invitation` envelopes that
    carry a `receipt_id` (receipt-based re-invitation, Section 9.1.6). The HMAC
    key is the named receipt's `secret`.
  - `x-rpp-invitation-id` for `receipt` envelopes (acceptance callback, Section
    9.7). The HMAC key is the original invitation's `delivery_token`.
- `invitation` envelopes that carry only a `receptive_policy_id` (first contact
  through an open receptive policy) MAY be submitted without an identity header
  or HMAC; in that case the embedded `receptive_policy_id` itself acts as the
  bearer credential authorizing delivery into that policy window.
- The server rejects requests with missing or malformed signature or timestamp
  headers using the corresponding Section 5.1 error codes.
- The server rejects requests that present multiple identity headers, or an
  identity header that does not match the envelope `category`, with
  `E_INVALID_AUTH_HEADERS`.
- The server resolves the HMAC key by looking up the record named by the
  identity header (receipt or invitation) and reading the associated key
  (`receipt_secret` or `delivery_token`).
- Unknown receipt id is rejected with `E_RECEIPT_NOT_FOUND`. Unknown invitation
  id (on a `receipt` envelope) is rejected with `E_INVITATION_NOT_FOUND`.
- The server computes the signature using HMAC-SHA-256 with the resolved key.
- The HMAC input is the exact concatenation of the `x-rpp-timestamp` header
  value, a literal `.` character, and the raw request body bytes.
- The presented signature is lowercase hexadecimal.
- If the computed HMAC does not match the presented signature, the server
  rejects the request with `E_RECEIPT_INVALID_SIGNATURE` (when keyed by receipt)
  or `E_DELIVERY_TOKEN_INVALID` (when keyed by delivery token).
- The envelope endpoint uses credential-based authorization failures with HTTP
  403, not HTTP 401.
