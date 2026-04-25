---
id: submit-004
title: Submit requests validate the base message envelope before acceptance
---

# Submit Envelope Validation

Before a message is accepted, the submit endpoint MUST validate the request body
against the base RPP message envelope contract (Section 5.1, Section 7.1,
Section 7.1.1, Section 7.1.2).

## Expected behavior

- The request body is valid JSON; otherwise the server rejects it with
  `E_INVALID_REQUEST_BODY`.
- The request body includes the required message envelope fields defined by the
  base RPP envelope.
- If required envelope fields are missing, the server rejects the request with
  `E_INVALID_MESSAGE_ENVELOPE`.
- The message body size does not exceed 256 KB; oversized requests are rejected
  with `E_MESSAGE_TOO_LARGE`.
- `message_id` is unique per `sender_domain` and is used as part of replay and
  deduplication checks.
- `sender_domain` is validated against the receipt context before message
  delivery is accepted.
- `content_type` is restricted to `text/markdown` for human-readable message
  bodies.
