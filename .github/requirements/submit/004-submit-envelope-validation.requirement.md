---
id: submit-004
title: Envelope requests are validated against the kind-specific schema before acceptance
---

# Envelope Validation

Before an envelope is accepted, the envelope endpoint MUST validate the request
body against the schema for its declared kind (Section 5.1, Section 7, Section
7.1.1, Section 7.1.2, Section 9.7.2). Envelope kind is determined by the
top-level `category` field.

## Expected behavior

- The request body is valid JSON; otherwise the server rejects it with
  `E_INVALID_REQUEST_BODY`.
- The total request body size does not exceed 256 KB; oversized requests are
  rejected with `E_MESSAGE_TOO_LARGE`.
- The server reads the top-level `category` field and dispatches to the matching
  kind-specific validator.

### Message envelope (§7.1)

- The request body includes the required message envelope fields defined by the
  base RPP envelope.
- If required envelope fields are missing, the server rejects the request with
  `E_INVALID_MESSAGE_ENVELOPE`.
- `message_id` is unique per `sender_domain` and is used as part of replay and
  deduplication checks.
- `sender_domain` is validated against the receipt context before message
  delivery is accepted.
- `content_type` MUST be one of `text/markdown` (UTF-8 CommonMark) or
  `application/json` (UTF-8 JSON document whose top-level value is an object or
  array). Any other `content_type` is rejected with `E_INVALID_CONTENT_TYPE`.
  Servers MUST validate JSON syntactic well-formedness for `application/json`
  bodies and reject malformed JSON with `E_INVALID_BODY`. Servers MUST NOT
  perform application-level schema validation.

### Invitation envelope (§9)

- The envelope includes an `invitation` object with at minimum `invitation_id`,
  `proposed_terms`, and a `delivery` block (Section 9.7.1).
- The `delivery` block MUST include `domain` (sender's RPP domain) and `token`
  (a sender-generated single-use HMAC key for the future receipt callback). The
  block MAY include `expires_at`.
- Exactly one of `receptive_policy_id` or `receipt_id` MUST be present on the
  invitation; both or neither is invalid.
- If required fields are missing, the server rejects with
  `E_INVALID_MESSAGE_ENVELOPE`.

### Receipt envelope (§9.7.2)

- The envelope MUST include `category: "receipt"`, `invitation_id`, and
  `decision` (`"accepted"` or `"rejected"`).
- When `decision` is `"accepted"`, the envelope MUST include a `receipt` object
  with at minimum `id`, `secret`, `category`, `max_content_rating`,
  `usage_policy`, and `issued_at`.
- When `decision` is `"rejected"`, the `receipt` field MUST be absent.
- The `reason` field is OPTIONAL on either decision and is human-facing only.
- If the envelope is structurally invalid (missing required fields, malformed
  receipt block, decision/receipt mismatch), the server rejects with
  `E_RECEIPT_ENVELOPE_INVALID`.
