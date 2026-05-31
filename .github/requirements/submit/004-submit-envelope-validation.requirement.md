---
id: submit-004
title: Envelope requests are validated against the category-specific schema before acceptance
spec_ref: "5, 6, 7, 10"
---

# Envelope Validation

Before an envelope is accepted, the envelope endpoint MUST validate the request
body against the schema for its declared category (§5, §6, §7.1, §10.1, §10.4).
Envelope category is determined by the top-level `category` field.

## Expected behavior

- The request body is valid JSON; otherwise the server rejects it with
  `E_INVALID_REQUEST_BODY` (§13).
- The total request body size does not exceed 256 KB; oversized requests are
  rejected with `E_MESSAGE_TOO_LARGE` (§13).
- The server reads the top-level `category` field and dispatches to the matching
  category-specific validator. Unknown `category` is rejected with
  `E_INVALID_ENVELOPE`.
- Every envelope MUST include `envelope_id` (UUIDv7), `sender_domain`,
  `sent_at`, and `category` (§5). Missing or malformed common fields are
  rejected with `E_INVALID_ENVELOPE`.

### Message envelope (§7.1)

- The envelope MUST include `category` (from §7.1 message categories),
  `content_rating` (from §7.2), and a `body` object containing `content_type`
  and `content`.
- `content_type` MUST be one of `text/markdown` (UTF-8 CommonMark) or
  `application/json` (UTF-8 JSON document whose top-level value is an object or
  array). Any other `content_type` is rejected with `E_INVALID_CONTENT_TYPE`
  (§13). Servers MUST validate JSON syntactic well-formedness for
  `application/json` bodies and reject malformed JSON with `E_INVALID_BODY`.
  Servers MUST NOT perform application-level schema validation.
- If required envelope fields are missing, the server rejects with
  `E_INVALID_MESSAGE_ENVELOPE` (§13).
- The named contact's `remote_terms.categories` MUST include this message's
  `category` and `remote_terms.max_content_rating` MUST be at least as
  permissive as `content_rating`. On violation reject with
  `E_CATEGORY_NOT_PERMITTED` or `E_CONTENT_RATING_EXCEEDED` (§11.5, §13).

### Invitation envelope (§10.1)

- The envelope MUST include `invitation_id`, `receptive_policy_id`,
  `communication_terms`, `reply_credential` (`{ contact_id, contact_secret }`),
  and `claims.immutable.domain_id`.
- If required fields are missing, the server rejects with
  `E_INVALID_INVITATION_ENVELOPE` (§13).
- The named `receptive_policy_id` (or its shortcode) MUST resolve to an active
  local policy. Unknown policy id is rejected with
  `E_RECEPTIVE_POLICY_NOT_FOUND`; expired with `E_RECEPTIVE_POLICY_EXPIRED`;
  admission failure with `E_RECEPTIVE_POLICY_CLOSED` (§9, §13).

### Invitation_reply envelope (§10.4)

- The envelope MUST include `invitation_id` (referencing the local outbound
  invitation), `communication_terms`, `reply_credential`
  (`{ contact_id, contact_secret }`), and `claims.immutable.domain_id`.
- The `x-rpp-contact-id` header MUST name the locally persisted outbound
  `reply_credential` for the referenced invitation (see `req:submit-002`).
- If required fields are missing or the referenced invitation is not in
  `pending` state, the server rejects with `E_INVITATION_NOT_PENDING` or
  `E_INVALID_INVITATION_REPLY_ENVELOPE` (§13).
