---
id: submit-001
title: Servers expose an envelope endpoint that accepts message, invitation, and receipt envelopes
---

# Envelope Endpoint

The server MUST expose an HTTP envelope endpoint for backend-to-backend delivery
of RPP envelopes (Section 4.2, Section 7). The recommended path is
`POST /rpp/v1/envelopes`. The endpoint accepts three envelope kinds,
discriminated by the top-level `category` field:

| `category`   | Kind       | Spec section |
| ------------ | ---------- | ------------ |
| `invitation` | invitation | §9           |
| `receipt`    | receipt    | §9.7         |
| any other    | message    | §7.1         |

## Expected behavior

- The server exposes a POST endpoint at `/rpp/v1/envelopes`.
- The endpoint accepts exactly one envelope per request.
- Fanout is not implicit at the transport layer; multiple deliveries require
  multiple independent submissions.
- The request body is JSON.
- The server dispatches the envelope to a kind-specific handler based on the
  top-level `category` field.
- On successful acceptance, the endpoint responds with HTTP 202.
- The response body shape varies by envelope kind:
  - `message` envelope: `{ ok, accepted, message_id }`.
  - `invitation` envelope: `{ ok, accepted, invitation_id }`. If the receiver
    auto-accepts at submit time, the response MAY additionally include the
    issued `receipt` inline (Section 7.4 auto-accept optimization).
  - `receipt` envelope: `{ ok, accepted, invitation_id }` confirming the
    callback was processed and the delivery token consumed.
