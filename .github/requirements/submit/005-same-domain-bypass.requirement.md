---
id: submit-005
title: Envelope delivery short-circuits to the local handler for same-domain recipients
spec_ref: null
application_specific: true
---

# Same-Domain Envelope Delivery Short-Circuit

**This requirement is application-specific and is NOT derived from the RPP
specification.** It exists to work around a hard runtime constraint of Deno
Deploy and to keep the same-domain path testable in isolation. The spec treats
every envelope delivery as an HTTP POST to the receiver's
`POST /rpp/v1/envelopes` endpoint; this requirement adds a strictly internal
delivery path that is functionally equivalent to that POST but never touches the
network.

## Rule

When any code path in this server attempts to deliver an envelope (`invitation`,
`invitation_reply`, or `message`) whose target domain case-insensitively equals
`ConfigService.domain` (the server's own configured authority, e.g.
`example.com` or `localhost:8000`), the server **MUST NOT** issue an outbound
HTTP request to its own envelope endpoint. Instead it MUST invoke the
corresponding inbound envelope handler in-process, as if the envelope had just
arrived from the network.

This applies to **every** outbound delivery site, including (but not limited
to):

- `send_invitation` (§10.1) — `invitation` envelope
- `invite_contact` (§11.3) — `invitation` envelope
- `cancel_invitation` (§10.3) — cancellation `invitation` envelope
- `accept_invitation` (§10.4) — `invitation_reply` envelope
- `send_message` (§7) — `message` envelope

## Why this is application-specific

1. **Deno Deploy loop detection.** Deno Deploy intercepts any HTTP request a
   deployment makes back to its own hostname and returns
   `HTTP 508 Loop Detected`, terminating the request before it reaches the
   isolate's HTTP server. This makes the spec-prescribed wire path structurally
   impossible for same-domain delivery on the production runtime.
2. **No untrusted boundary is crossed.** When sender and receiver live in the
   same isolate / process, there is no network attacker to defend against on the
   wire. The HMAC signature and receptive-policy-id header only exist to
   authenticate across that boundary; on the in-process path they are redundant
   and MUST be skipped.

## Required behavior

- A single dispatcher abstracts envelope delivery. At every call site, tools
  invoke the dispatcher (never `fetch` to `/rpp/v1/envelopes` directly).
- The dispatcher compares the target domain against `ConfigService.domain` using
  case-insensitive equality.
- **Same domain** → the dispatcher calls the matching in-process handler:
  - `invitation` → `InvitationEnvelopeHandler.handle(envelope, now)`
  - `invitation_reply` → `InvitationReplyEnvelopeHandler.handle(envelope, now)`
  - `message` → `MessageEnvelopeHandler.handle(envelope, contactId, now)`
- The same-domain path MUST NOT:
  - sign the envelope with HMAC,
  - verify any signature,
  - require / read `x-rpp-contact-id`, `x-rpp-receptive-policy-id`,
    `x-rpp-shortcode`, `x-rpp-timestamp`, or `x-rpp-signature` headers,
  - run any freshness-window check,
  - call `globalThis.fetch` for delivery.
- The same-domain path MUST still:
  - run the full schema validation that the inbound controller would (envelope
    handlers already do this),
  - perform every contact / reply-credential / receptive-policy lookup the
    inbound path performs,
  - record the same KV state on the receiver side (inbound invitation, stored
    message, contact upsert, invitation transition, etc.).
- **Different domain** → the dispatcher falls back to the normal outbound HTTP
  path (HMAC signed where applicable, headers set per §6.1 / §8.1).
- The functional outcome (envelope persisted, contact created / updated,
  invitation status transitioned, message delivered) MUST be observationally
  identical regardless of which path was taken.

## Verification

The requirement test for `submit-005` MUST:

- exercise all three same-domain envelope paths through real MCP tool calls,
- stub `globalThis.fetch` for the duration of the test and assert that **zero**
  requests are issued to any URL whose path is `/rpp/v1/envelopes`,
- confirm the receiver-side KV state was updated by the in-process handler.
