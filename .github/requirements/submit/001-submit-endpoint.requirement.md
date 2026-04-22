---
id: submit-001
title: Servers expose a submit endpoint for one message envelope per request
---

# Submit Endpoint

The server MUST expose an HTTP submit endpoint for backend-to-backend delivery
of RPP messages (Section 4.1, Section 4.3, Section 7.1). The recommended path is
`POST /rpp/v1/messages`.

## Expected behavior

- The server exposes a POST endpoint at `/rpp/v1/messages`.
- The endpoint accepts exactly one message envelope per request.
- Fanout is not implicit at the transport layer; multiple deliveries require
  multiple independent submissions.
- The request body is JSON and contains the base message envelope fields defined
  by Section 7.1.
- On successful acceptance, the endpoint responds with HTTP 202.
- The response indicates that the message was accepted for processing and
  includes a server-traceable message identifier.
