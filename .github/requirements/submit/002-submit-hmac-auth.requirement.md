---
id: submit-002
title: Submit requests are authenticated with receipt-based HMAC signatures
---

# Submit HMAC Authentication

The submit endpoint MUST use receipt-based, request-bound authentication instead
of bearer tokens (Section 5.1). Each request is authorized by a previously
issued receipt and authenticated by an HMAC over the raw request body.

## Expected behavior

- Every submit request includes `x-rpp-receipt-id`, `x-rpp-signature`, and
  `x-rpp-timestamp` headers.
- The server rejects requests with missing or malformed receipt id, signature,
  or timestamp headers using the corresponding Section 5.1 error codes.
- The server looks up the referenced receipt and rejects unknown receipts with
  `RECEIPT_NOT_FOUND`.
- The server computes the signature using HMAC-SHA-256 with the receipt secret
  as the key.
- The HMAC input is the exact concatenation of the `x-rpp-timestamp` header
  value, a literal `.` character, and the raw request body bytes.
- The presented signature is lowercase hexadecimal.
- If the computed HMAC does not match the presented signature, the server
  rejects the request with `RECEIPT_INVALID_SIGNATURE`.
- The submit endpoint uses receipt-based authorization failures with HTTP 403,
  not HTTP 401.
