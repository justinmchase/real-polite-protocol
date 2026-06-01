---
id: submit-001
title: Servers expose an envelope endpoint accepting message, invitation, and invitation_reply envelopes
spec_ref: "4.2, 5, 6, 7, 10"
---

# Envelope Endpoint

The server MUST expose an HTTP envelope endpoint for backend-to-backend delivery
of RPP envelopes (§4.2, §5, §6). The recommended path is
`POST /rpp/v1/envelopes`. The endpoint accepts three envelope categories,
discriminated by the top-level `category` field:

| `category`         | Spec section |
| ------------------ | ------------ |
| `invitation`       | §10.1        |
| `invitation_reply` | §10.4        |
| `message`          | §7.1         |

## Expected behavior

- The server exposes a POST endpoint at `/rpp/v1/envelopes`.
- The endpoint accepts exactly one envelope per request.
- Fanout is not implicit at the transport layer; multiple deliveries require
  multiple independent submissions.
- The request body is JSON.
- The server dispatches the envelope to a category-specific handler based on the
  top-level `category` field.
- On successful acceptance, the endpoint responds with HTTP 202.
- The response body is a uniform `{ ok: true, accepted: true, envelope_id }`
  acknowledgement so that no category-specific identifiers leak through the
  uniform transport.
