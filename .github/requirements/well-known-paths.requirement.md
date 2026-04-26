---
id: well-known-001
title: Domain identity well-known endpoint
---

# Well-Known Domain Identity Endpoint

An RPP server SHOULD expose a publicly accessible domain identity document at
`/.well-known/rpp-domain-identity` that allows cross-domain peers to discover
the server's endpoint URLs and metadata without relying solely on path
conventions (spec §12.1).

## Expected behavior

- The endpoint MUST accept HTTP GET requests with no authentication.
- The response MUST use HTTP 200 and `Content-Type: application/json`.
- The response body MUST be a JSON object.
- The response MUST include `domain` — the DNS hostname of this RPP server.
- The response MUST include `display_name` — a human-readable name for the
  domain.
- The response MUST include `envelope_endpoint` — the full HTTPS URL of the
  envelope endpoint (e.g. `https://example.com/rpp/v1/envelopes`).
- The response MUST include `mcp_endpoint` — the full HTTPS URL of the MCP
  endpoint (e.g. `https://example.com/mcp`).
- The response MAY include `domain_type` — one of the registered domain type
  values (`personal`, `business`, `academic`, `government`, `nonprofit`,
  `healthcare`, `media`).
- The response MAY include `parent_domain` — a parent organization domain.
- The response MAY include `categories_offered` — an array of message category
  strings this domain typically sends.
- The response MAY include `rpp_since` — an ISO 8601 timestamp of when the
  domain first began operating an RPP server.
- The response MAY include `contact_policy_url` — a URL for out-of-band
  administrative contact.
- The response MAY include `public_key` — a domain verification key object with
  `algorithm` (MUST be `"Ed25519"`) and `key` (Base64-encoded SPKI) fields.
- Peers that receive a 404 from this endpoint MUST fall back to the conventional
  endpoint paths defined in spec §4.2.
