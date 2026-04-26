---
id: messages-001
title: Listeners can send messages using a held receipt
spec_ref: "7.1, 10B.1, 6"
---

# Send Message

The MCP server MUST expose `send_message` so an authenticated listener can
compose and deliver a message to another RPP server using a receipt they hold
(Section 10B.1, Section 7.1).

The server performs HMAC signing and HTTP POST on behalf of the listener; the
caller never handles the receipt secret directly.

## Expected behavior

- The tool is available to any authenticated account.
- The tool requires:
  - `receipt_id` — the held receipt authorizing the send.
  - `category` — one value from the category registry (Section 7.2).
  - `content_rating` — one value from the content rating registry (Section 7.3).
  - `body` — an object with a `content_type` and a `content` field (Section
    7.1.2). The `content_type` MUST be one of:
    - `text/markdown` — `content` is a UTF-8 CommonMark string.
    - `application/json` — `content` is a UTF-8 string containing a valid JSON
      document whose top-level value is an object or array. Any other
      `content_type` MUST be rejected with `E_INVALID_CONTENT_TYPE`. If
      `content_type` is `application/json` and the body is not syntactically
      valid JSON, the server MUST reject with `E_INVALID_BODY`.
- The tool MAY accept:
  - `subject` — informational subject line.
  - `sender_display_name` — Unicode string (Section 3A.2); informational only.
  - `reply_invite` — an embedded invitation offering the receiver a reply path
    (Section 8).
  - `metadata` — a free-form object passed through to the receiver.
- The tool MUST verify that the receipt belongs to the authenticated account
  before sending; receipts held by other accounts MUST NOT be usable.
- The server MUST generate a UUIDv7 `message_id` and ensure
  `(sender_domain, message_id)` is unique per the local sender domain.
- The server MUST construct the submit envelope per Section 7.1, sign it via
  HMAC-SHA-256 using the receipt secret, and POST it to the receiver's envelope
  endpoint with the `x-rpp-receipt-id`, `x-rpp-timestamp`, and `x-rpp-signature`
  headers.
- If the receiver returns a non-2xx response, the tool MUST surface a structured
  error to the caller including the receiver's error code when available.
- If the receipt is not active (revoked or expired), the tool MUST reject the
  call locally with `E_RECEIPT_NOT_ACTIVE` without contacting the receiver.
- If the message body exceeds 256 KB (Section 7.1.1), the tool MUST reject the
  call locally with `E_MESSAGE_TOO_LARGE`.
- On success the tool returns the new `message_id`, `sent_at` timestamp, and the
  receiver's accepted-response payload.

## Out of scope

- Group fan-out (`send_group_message` is a separate tool, Section 10B.2).
- Mutating the held receipt's terms (use `renew_receipt`, Section 10A.4).
