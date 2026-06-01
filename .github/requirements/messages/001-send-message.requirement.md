---
id: messages-001
title: Listeners can send messages to a known contact
spec_ref: "7, 7.1, 11, 12.4"
---

# Send Message

The MCP server MUST expose `send_message` so an authenticated local user can
compose and deliver a `message` envelope to another RPP server using an
established contact (§7, §12.4).

The server performs HMAC signing and HTTP POST on behalf of the local user; the
caller never handles the `contact_secret` directly.

## Expected behavior

- The tool is available to any authenticated account.
- The tool requires:
  - `contact_id` — the local contact identifying the recipient (§11).
  - `category` — one value from the §7.1 category registry.
  - `content_rating` — one value from the §7.2 content rating registry.
  - `body` — an object with a `content_type` and a `content` field
    (`req:submit-004`). `content_type` MUST be one of `text/markdown` or
    `application/json`. Other values are rejected with `E_INVALID_CONTENT_TYPE`.
    Malformed JSON is rejected with `E_INVALID_BODY`.
- The tool MAY accept:
  - `subject` — informational subject line.
  - `metadata` — a free-form object passed through to the remote
    (`req:messages-007`).
- The tool MUST verify the contact belongs to the authenticated account;
  contacts owned by other accounts MUST NOT be addressable.
- The tool MUST reject locally with `E_CONTACT_BLOCKED` if the contact is
  blocked (`req:contacts-008`).
- Soft term enforcement (§11.5): the tool MUST reject locally if the recipient's
  `contact.remote_terms` does not permit this `category` or `content_rating`,
  with `E_CATEGORY_NOT_PERMITTED` or `E_CONTENT_RATING_EXCEEDED` (§13). This
  mirrors the inbound check at `req:submit-004`.
- The server MUST generate a UUIDv7 `envelope_id` and ensure
  `(sender_domain, envelope_id)` is unique per the local sender domain.
- The server MUST construct the `message` envelope per §7.1, sign it via
  HMAC-SHA-256 using `contact.remote_credential.contact_secret`, and POST it to
  the remote's envelope endpoint with the headers
  `x-rpp-contact-id: <contact.remote_credential.contact_id>`, `x-rpp-timestamp`,
  and `x-rpp-signature` (`req:submit-002`).
- If the remote returns a non-2xx response, the tool MUST surface a structured
  error to the caller including the remote's error code when available.
- If the envelope body exceeds 256 KB, the tool MUST reject the call locally
  with `E_MESSAGE_TOO_LARGE`.
- On success the tool returns the new `envelope_id`, `sent_at` timestamp, and
  the remote's accepted response payload.

## Same-domain (local) delivery

When the contact's `remote_domain` equals the local domain, the message MUST be
delivered by calling the local message handler directly without making an
outbound HTTP request (per `req:submit-005`). HMAC signing and verification MAY
be skipped on the local path.
