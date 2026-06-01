---
id: submit-005
title: Envelope delivery bypasses outbound HTTP for same-domain recipients
spec_ref: "4.2"
---

# Same-Domain Envelope Delivery Bypass

When any RPP tool delivers an envelope to a recipient whose domain equals the
server's own domain, the server MUST NOT make an outbound HTTP request to
`POST /rpp/v1/envelopes`. Instead, it MUST invoke the appropriate local handler
directly, as if the envelope had arrived over the network.

This requirement applies to every envelope delivery path including but not
limited to:

- `send_invitation` (§10.3) — `invitation` envelopes sent to the remote domain.
- `invite_contact` (§11.3) — `invitation` envelopes re-sent to a known contact's
  domain.
- `accept_invitation` (§10.4) — `invitation_reply` envelopes sent to the
  original sender's domain.
- `send_message` (§7) — `message` envelopes sent to a contact's domain.

## Rationale

Deno Deploy detects HTTP requests from a deployment to its own hostname and
returns HTTP 508 Loop Detected, terminating the request. Calling the local
handler directly avoids the self-loop and is semantically equivalent to an
inbound HTTP delivery.

## Expected behavior

- For each envelope delivery path, the server compares the target domain against
  its configured local domain (`ConfigService.domain`).
- When the domains match, the server calls the local handler directly without
  making any HTTP request. HMAC signing and verification MAY be skipped on the
  local path because no untrusted network boundary is crossed; the handler still
  performs all schema validation and contact / reply-credential lookups
  identical to the inbound path.
- When the domains differ, the server proceeds with the normal outbound HTTP
  delivery as specified in §4.2 / §6.1.
- The functional outcome (envelope stored, contact created or updated,
  invitation transitioned) MUST be identical regardless of whether local or
  remote delivery is used.
