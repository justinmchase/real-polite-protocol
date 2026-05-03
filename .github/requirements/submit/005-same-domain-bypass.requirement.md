---
id: submit-005
title: Envelope delivery bypasses outbound HTTP for same-domain recipients
---

# Same-Domain Envelope Delivery Bypass

When any RPP tool delivers an envelope to a recipient whose domain equals the
server's own domain, the server MUST NOT make an outbound HTTP request to
`POST /rpp/v1/envelopes`. Instead, it MUST invoke the appropriate local handler
directly, as if the envelope had arrived over the network.

This requirement applies to every envelope delivery path including but not
limited to:

- `send_invitation` — invitation envelopes sent to the receiver's domain
- `invite_contact` — invitation envelopes sent to a contact's domain
- `send_message` — message envelopes sent to the receiver's domain

Receipt callback delivery (after `accept_invitation` / `reject_invitation`) is
excluded because the receipt is always sent back to the invitation _sender's_
domain, which is already guarded in the callers: the HTTP call is skipped
entirely when `delivery.domain` equals the local domain.

## Rationale

Deno Deploy detects HTTP requests from a deployment to its own hostname and
returns HTTP 508 Loop Detected, terminating the request. Calling the local
handler directly avoids the self-loop and is semantically equivalent to an
inbound HTTP delivery.

## Expected behavior

- For each envelope delivery path, the server compares the target domain against
  its configured local domain (`ConfigService.domain`).
- When the domains match, the server calls the local handler (e.g.,
  `invitationManager.deliverLocally(...)`, `messageManager.store(...)`) directly
  without making any HTTP request.
- When the domains differ, the server proceeds with the normal outbound HTTP
  delivery as specified in §4.2 / §7.
- The functional outcome (envelope stored, receipts issued, etc.) MUST be
  identical regardless of whether local or remote delivery is used.
