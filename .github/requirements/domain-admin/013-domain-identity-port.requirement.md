---
id: domain-admin-013
title: Domain identity includes port when non-standard
---

# Domain Identity Port Inclusion

The server's domain identity MUST accurately reflect the authority component
(host + port) of its public address so that other servers can construct correct
URLs when delivering messages.

## Rules

- When the server is running on port 443 AND the domain is not `localhost`, the
  domain identity MUST NOT include the port suffix (e.g. `example.com`).
- In all other cases — including `localhost` with any port, or any
  non-`localhost` domain with a port other than 443 — the domain identity MUST
  include the port suffix (e.g. `localhost:8000` or `example.com:8080`).

## Expected behavior

- A server started on `localhost:8000` exposes a domain identity of
  `localhost:8000`.
- A server started on `localhost:443` exposes a domain identity of
  `localhost:443` (localhost is always explicit about its port).
- A server configured with domain `example.com` on port 443 exposes a domain
  identity of `example.com`.
- A server configured with domain `example.com` on port 8080 exposes a domain
  identity of `example.com:8080`.
- The `RPP_DOMAIN` environment variable, when set, overrides automatic
  derivation entirely.
