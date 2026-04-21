# Real Polite Protocol (RPP)

Document: RPP Core Specification Status: Internet-Draft Version: 0.2.0-draft
Last Updated: 2026-03-31

## Abstract

The Real Polite Protocol (RPP) is an HTTP-based messaging protocol intended as a
replacement for email-style communication between software agents and services.
RPP is "polite" because unsolicited delivery is disallowed at the protocol
layer: a sender MUST possess a valid receiver-issued receipt before a message is
accepted.

This document defines a core model with two interfaces:

- a single RPP backend-to-backend HTTP POST endpoint for message submission,
- an MCP endpoint for authenticated listener connections, allowing participants
  to send and receive messages via their own servers.

## 1. Conformance Language

The key words MUST, MUST NOT, REQUIRED, SHALL, SHALL NOT, SHOULD, SHOULD NOT,
RECOMMENDED, MAY, and OPTIONAL in this document are to be interpreted as
described in RFC 2119 and RFC 8174.

## 2. Scope and Goals

RPP defines:

- message delivery requirements between one sender and one receiver,
- receipt-based permissioning and anti-unsolicited enforcement,
- authenticated MCP access for listener-oriented workflows,
- standardized categories, invitation flows, and reply affordances.

RPP does not define human-facing mailbox UX or storage implementation details.

## 3. Core Entities

- Sender: The originator of a message.
- Receiver: The destination of a message.
- Domain: A DNS hostname operating an RPP server.
- Receipt: A receiver-issued permission token describing what a sender may send.
- Reply Receipt: An optional receipt embedded in a message to permit a response.
- Invitation: A special category message that proposes a future receipt grant.
- Public Invitation: A standing invitation discoverable by invitation ID.
- Listener: An authenticated MCP client connected to its own RPP server.

## 3A. User Identity Model

RPP deliberately avoids email-style addresses. There is no protocol-level
username, mailbox identifier, or structured address format. RPP routes messages
by **receipt ID**, not by user address. Invitations are discovered by
**invitation ID**, not sent to an address.

This design eliminates entire classes of problems inherited from email: no
address harvesting, no misspelled addresses, no case-sensitivity debates, no
special-character escaping, and no need for global uniqueness of user
identifiers.

### 3A.1 Domains as the Only Protocol-Level Identity

The only identity that crosses domain boundaries at the protocol level is the
**domain name** — a DNS hostname (e.g., `sender.example`). Domain names MUST be
valid DNS hostnames and are always lowercase.

Users are local to their domain server. The protocol does not define, require,
or transmit any user-level identifier across domain boundaries.

### 3A.2 Display Names

Users MAY present themselves to other parties via a **display name**: any
Unicode string of their choosing. Display names are purely informational and
have no protocol significance.

- A display name is OPTIONAL. Users are not required to present one.
- A display name MAY be any Unicode string (including spaces, emoji, non-Latin
  scripts, or punctuation). There is no character restriction.
- Display names MUST NOT exceed 256 Unicode code points.
- A user MAY use different display names in different contexts:
  - A different display name on each receipt they issue.
  - A different display name on each public invitation they create.
  - No display name at all.
- Display names MUST NOT be used for routing, authentication, or authorization.
  They are cosmetic metadata only.
- Servers MUST NOT require users to provide a display name as a condition of
  creating an account, issuing a receipt, or publishing an invitation.

### 3A.3 Voluntary Identity Disclosure on Receipts

When a receiver issues a receipt (via invitation acceptance or reply receipt),
the receiver MAY attach a voluntary display name to the receipt. This helps the
sender identify who granted the receipt but is never required and never used for
authentication.

- The only required receipt metadata is the receipt `id` and `secret` (Section
  6.1). A display name is OPTIONAL.
- The receiver MAY provide different display names on different receipts. For
  example, a user might share their full name with a colleague but a pseudonym
  with a business.
- The receiver MAY change the display name on a replacement receipt (Section
  10A.4) without the sender's consent.
- The sender MUST NOT assume that the absence of a display name means the
  receipt is invalid or anonymous — it simply means the receiver chose not to
  share that information.
- Servers MUST NOT require receivers to disclose a display name as a condition
  of issuing a receipt.

## 4. Transport Model

### 4.1 Required Endpoints

An RPP server MUST expose two HTTP endpoints:

1. RPP Submit Endpoint (backend-to-backend):
   - Method: POST
   - Path: implementation-defined (RECOMMENDED: /rpp/v1/messages)
   - Purpose: Accept one message envelope per request.

2. MCP Endpoint (listener interface):
   - Transport: MCP over HTTP
   - Path: implementation-defined (RECOMMENDED: /mcp)
   - Purpose: Authenticated send/receive and workflow orchestration for local
     listeners connected to their own server domain.

### 4.2 Agent and Cross-Server Communication

- Agents connect to the MCP endpoint of their own RPP server domain.
- Tools executed via MCP MAY call HTTP submit endpoints on other RPP servers.

### 4.3 Message Cardinality

- Each delivered message MUST have exactly one sender and exactly one receiver.
- Fanout MUST be expressed as multiple independent message submissions.

## 5. Authentication and Authorization

### 5.1 Submit Endpoint Authentication

RPP submit authentication is receipt-based and request-bound.

Each POST request MUST include:

- x-rpp-receipt-id: Identifier of a previously issued receipt.
- x-rpp-signature: Signature derived from hashing the raw request body with the
  receipt secret.
- x-rpp-timestamp: ISO 8601 UTC timestamp of when the request was created (see
  Section 5.1.1).

Initial profile (v0.2 draft):

- Algorithm: HMAC-SHA-256
- Construction: HMAC_SHA256(key=receipt_secret, data=x-rpp-timestamp + "." +
  request_body_bytes)
- Encoding: lowercase hex

The HMAC input MUST be the concatenation of the `x-rpp-timestamp` header value,
a literal ASCII period (`.`), and the raw request body bytes. This binds the
timestamp to the signature and prevents an attacker from replaying a captured
request with a fresh timestamp.

Servers MUST reject requests with missing, unknown, malformed, expired, or
policy-violating receipt context.

The following table defines the error conditions, their HTTP status codes, and
RPP error codes that MUST be returned by the submit endpoint:

| Condition                                | HTTP | RPP Error Code            |
| ---------------------------------------- | ---- | ------------------------- |
| x-rpp-receipt-id header missing          | 400  | MISSING_RECEIPT_ID        |
| x-rpp-signature header missing           | 400  | MISSING_SIGNATURE         |
| x-rpp-timestamp header missing           | 400  | MISSING_TIMESTAMP         |
| x-rpp-receipt-id value is malformed      | 400  | MALFORMED_RECEIPT_ID      |
| x-rpp-signature value is malformed       | 400  | MALFORMED_SIGNATURE       |
| x-rpp-timestamp value is malformed       | 400  | MALFORMED_TIMESTAMP       |
| Request body is not valid JSON           | 400  | INVALID_REQUEST_BODY      |
| Required message envelope fields missing | 400  | INVALID_MESSAGE_ENVELOPE  |
| Timestamp exceeds freshness window       | 400  | REQUEST_STALE             |
| Duplicate message_id within dedup window | 400  | DUPLICATE_MESSAGE         |
| Receipt id not recognized by this server | 403  | RECEIPT_NOT_FOUND         |
| Signature does not match computed HMAC   | 403  | RECEIPT_INVALID_SIGNATURE |
| Receipt has been revoked                 | 403  | RECEIPT_REVOKED           |
| Receipt has expired                      | 403  | RECEIPT_EXPIRED           |
| Receipt usage limit exhausted            | 403  | RECEIPT_USAGE_EXHAUSTED   |
| Request outside receipt time-window      | 403  | RECEIPT_TIME_RESTRICTED   |
| Receipt interval budget exceeded         | 403  | RECEIPT_INTERVAL_EXCEEDED |
| Message category does not match receipt  | 403  | RECEIPT_CATEGORY_MISMATCH |
| Content rating exceeds receipt max       | 403  | RECEIPT_RATING_EXCEEDED   |
| content_rating field missing or invalid  | 400  | MISSING_CONTENT_RATING    |
| Receiver is not receptive to invitations | 403  | INVITATION_NOT_RECEPTIVE  |
| Referenced invitation has expired        | 409  | INVITATION_EXPIRED        |
| Referenced invitation has been cancelled | 409  | INVITATION_CANCELLED      |
| Request body exceeds 256 KB              | 413  | MESSAGE_TOO_LARGE         |
| group_id not recognized by this server   | 403  | GROUP_NOT_FOUND           |
| sender_domain not in group's member list | 403  | GROUP_SENDER_NOT_MEMBER   |
| Server encountered an unexpected failure | 500  | INTERNAL_ERROR            |

Notes:

- HTTP 413 is used when the request body exceeds the protocol maximum size
  (Section 7.1.1).
- HTTP 400 is used for syntactic and structural request errors that are
  independent of receipt validity.
- HTTP 403 is used for all receipt authorization failures. Servers MUST NOT use
  401 for the submit endpoint because authentication is receipt-based, not
  session-based.
- HTTP 409 is used when the request is well-formed but references an invitation
  in a terminal state (expired or cancelled).
- The RPP error code MUST be returned in the response body per the error model
  defined in Section 11.

#### 5.1.1 Replay Protection

RPP uses a combination of timestamp freshness and message ID deduplication to
prevent replay attacks.

**Timestamp freshness.** Every submit request MUST include an `x-rpp-timestamp`
header containing an ISO 8601 UTC timestamp (e.g., `2026-04-04T12:00:00Z`). The
receiving server MUST reject any request whose timestamp differs from the
server's current UTC time by more than **60 seconds** with `REQUEST_STALE`.

**Message ID deduplication.** The receiving server MUST maintain a
per-sender-domain cache of recently seen `message_id` values. If a request
arrives with a `message_id` that the server has already accepted from the same
`sender_domain` within the deduplication window, the server MUST reject the
request with `DUPLICATE_MESSAGE`. The deduplication cache MUST retain entries
for at least **60 seconds** — matching the timestamp freshness window. Servers
MAY retain entries longer.

These two mechanisms work together: the 60-second timestamp window limits how
long a captured request remains valid, and the message ID cache ensures that
even within that window, the same request cannot be accepted twice.

**Clock tolerance.** Servers SHOULD allow minor clock drift between domains. The
60-second window is chosen to accommodate typical NTP synchronization variations
while minimizing the replay window.

### 5.2 MCP Endpoint Authentication

The MCP endpoint MUST require authentication. RPP adopts the MCP authorization
specification, which is based on OAuth 2.1 with bearer tokens. This section
defines the normative requirements for RPP servers acting as OAuth 2.1 resource
servers and RPP agents acting as OAuth 2.1 clients.

#### 5.2.1 Standards Baseline

RPP MCP authentication is grounded in:

- OAuth 2.1 (draft-ietf-oauth-v2-1-13),
- OAuth 2.0 Protected Resource Metadata (RFC 9728),
- OAuth 2.0 Authorization Server Metadata (RFC 8414),
- OAuth 2.0 Dynamic Client Registration Protocol (RFC 7591),
- Resource Indicators for OAuth 2.0 (RFC 8707).

#### 5.2.2 Bearer Token Requirement

Every HTTP request from client to server on the MCP endpoint MUST include an
`Authorization` header with a bearer token:

```
Authorization: Bearer <access-token>
```

- Tokens MUST NOT be sent in query parameters or request bodies.
- The `Authorization` header MUST be present on every request, including those
  within the same logical MCP session.
- If no valid token is presented, the server MUST respond with HTTP 401
  Unauthorized and include a `WWW-Authenticate` header as defined in Section
  5.2.4.

#### 5.2.3 Token Validation

The RPP server, acting as an OAuth 2.1 resource server, MUST validate access
tokens per OAuth 2.1 Section 5.2. Specifically:

- The server MUST verify that the token was issued for itself as the intended
  audience (per RFC 8707).
- The server MUST reject tokens not specifically intended for it.
- The server MUST NOT forward or pass through tokens received from clients to
  any upstream service.
- Invalid or expired tokens MUST receive HTTP 401 Unauthorized.
- Tokens with insufficient scope MUST receive HTTP 403 Forbidden.

#### 5.2.4 Authorization Server Discovery

RPP servers MUST implement OAuth 2.0 Protected Resource Metadata (RFC 9728) to
advertise their authorization server(s):

- The server MUST serve a Protected Resource Metadata document at
  `/.well-known/oauth-protected-resource` that includes the
  `authorization_servers` field with at least one authorization server URL.
- When returning HTTP 401 Unauthorized, the server MUST include a
  `WWW-Authenticate` header indicating the resource metadata URL per RFC 9728
  Section 5.1.
- The authorization server MUST serve an Authorization Server Metadata document
  at `/.well-known/oauth-authorization-server` per RFC 8414.

#### 5.2.5 Client Registration

- RPP servers and authorization servers SHOULD support OAuth 2.0 Dynamic Client
  Registration (RFC 7591) so that agents can obtain client credentials
  automatically when connecting to new RPP servers.
- Authorization servers that do not support dynamic registration MUST document
  an alternative mechanism for agents to obtain a client ID.

#### 5.2.6 Authorization Flow

The authorization flow proceeds as follows:

1. Agent sends an MCP request without a token.
2. RPP server responds with HTTP 401 and `WWW-Authenticate` header containing
   the resource metadata URL.
3. Agent fetches `/.well-known/oauth-protected-resource` from the RPP server to
   obtain the authorization server URL.
4. Agent fetches `/.well-known/oauth-authorization-server` from the
   authorization server to discover endpoints.
5. If the agent is not yet registered, it registers via RFC 7591 dynamic
   registration.
6. Agent performs the OAuth 2.1 authorization code flow with PKCE.
   - The `resource` parameter (RFC 8707) MUST be included in both the
     authorization request and the token request, set to the canonical URI of
     the RPP server.
7. Agent receives an access token (and optionally a refresh token).
8. Agent retries the MCP request with `Authorization: Bearer <access-token>`.

#### 5.2.7 Security Requirements

- All MCP and authorization endpoints MUST be served over HTTPS.
- Agents MUST implement PKCE (per OAuth 2.1 Section 7.5.2) for all authorization
  code flows.
- Authorization servers SHOULD issue short-lived access tokens to limit the
  impact of token leakage.
- For public clients, authorization servers MUST rotate refresh tokens per OAuth
  2.1 Section 4.3.1.
- RPP servers MUST validate the `Origin` header on MCP requests to prevent DNS
  rebinding attacks.

#### 5.2.8 MCP Endpoint Error Codes

| HTTP Status | Condition                                      |
| ----------- | ---------------------------------------------- |
| 401         | No token, invalid token, or expired token      |
| 403         | Valid token but insufficient scope/permissions |
| 400         | Malformed authorization request or bad session |

## 6. Receipt Model

### 6.1 Receipt Properties

A receipt is receiver-controlled policy and MUST include:

- id: stable identifier used in x-rpp-receipt-id,
- secret: shared secret used for request signature validation,
- category: one allowed message category,
- max_content_rating: the maximum content rating the receiver will accept (see
  Section 7.3),
- usage policy: one-time, multiple-time, or any-time,
- validity constraints: optional time-of-day/week/month/year restrictions,
- interval budget: optional maximum uses within the defined interval,
- status: active, revoked, or expired.

### 6.2 Receipt Immutability

Receipts are immutable once issued. The only permitted state transition is from
active to revoked or from active to expired (via time-based expiry).

- A receiver MUST NOT alter the category, content rating, usage policy, validity
  constraints, or interval budget of an existing receipt.
- To change the terms under which a sender may communicate, the receiver MUST
  revoke the existing receipt and issue a replacement receipt with the desired
  new terms.
- The revocation-with-replacement mechanism (Section 10A.4) provides an atomic
  way to perform this operation and notify the sender of both the revocation and
  the new receipt in a single exchange.

### 6.3 Unsolicited Message Rejection

- An RPP server MUST reject any message that lacks a valid receipt.
- An RPP server MUST reject any message that violates the receipt policy.
- This behavior is protocol-mandatory and not optional anti-spam filtering.

### 6.4 Category Coupling

- Each message MUST carry exactly one category.
- The message category MUST match the receipt category.
- A receipt granting billing permissions MUST NOT authorize marketing messages.

### 6.5 Content Rating Enforcement

- Each message MUST carry exactly one content_rating value from the content
  rating registry (Section 7.3).
- Each receipt MUST specify a max_content_rating.
- The server MUST reject any message whose content_rating exceeds the receipt's
  max_content_rating per the ordering defined in Section 7.3.
- Content rating enforcement is protocol-mandatory and not advisory.

## 7. Message Model

### 7.1 Submit Request Envelope

The POST body MUST be JSON with this base shape:

```json
{
  "message_id": "019644a1-7e2a-7b3c-8d1e-1f2a3b4c5d6e",
  "sender_domain": "sender.example",
  "sender_display_name": "Alice Johnson",
  "category": "billing",
  "content_rating": "G",
  "sent_at": "2026-03-31T12:00:00Z",
  "subject": "Invoice 1042",
  "body": {
    "content_type": "text/markdown",
    "content": "Please find attached..."
  },
  "reply_receipt": null,
  "metadata": {}
}
```

- message_id MUST be a UUIDv7 (RFC 9562) and MUST be unique per sender domain.
  The combination of (sender_domain, message_id) forms the canonical message
  identifier. Receivers MUST reject duplicate message_ids from the same sender
  domain.
- sender_domain MUST be a valid DNS hostname matching the domain the receipt was
  issued to. The receiving server MUST validate this against the receipt.
- sender_display_name is OPTIONAL. It MAY be any Unicode string (Section 3A.2).
  It is informational only and MUST NOT be used for routing or authorization.
- The receiver is identified by the receipt ID in the `x-rpp-receipt-id` HTTP
  header. The receiving server looks up the receipt to determine which local
  user should receive the message. There is no receiver field in the envelope.
- category MUST be one value from the category registry.
- content_rating MUST be one value from the content rating registry.
- reply_receipt MAY be omitted or null.

### 7.1.1 Maximum Message Size

The maximum size of the HTTP request body for the submit endpoint is **256 KB**
(262,144 bytes). Servers MUST reject requests whose `Content-Length` exceeds
this limit with HTTP 413 and RPP error code `MESSAGE_TOO_LARGE`.

This limit applies to the entire JSON envelope including all body content. RPP
is not designed for large binary payloads — senders SHOULD include URLs
referencing external resources rather than embedding large content inline.

Servers MUST NOT accept request bodies larger than 256 KB, even if the
underlying HTTP server would otherwise permit it. This limit is protocol-
mandatory and not configurable.

### 7.1.2 Message Body Content Type

The `body` object in the message envelope MUST contain a `content_type` field
and a `content` field. RPP defines **Markdown** as the sole content type for
human-readable message bodies.

The `content_type` field MUST be `text/markdown`.

All messages MUST use `content_type: "text/markdown"`. The `content` field MUST
be a UTF-8 Markdown string conforming to CommonMark.

Senders SHOULD use CommonMark syntax for structure (headings, lists, links,
emphasis, code blocks). Senders MUST NOT embed raw HTML in Markdown content —
receiving clients SHOULD strip any HTML tags encountered during rendering.

This restriction gives RPP a single, portable, plaintext-safe format that every
client can render consistently. Unlike email, there is no negotiation between
HTML, plain text, and multipart alternatives. Markdown is readable as plain text
and renderable as rich text — one format serves both needs.

Servers MUST reject any message with a `content_type` other than
`text/markdown`.

### 7.2 Category Registry (Initial)

This draft defines the following initial categories:

- correspondence
- billing
- marketing
- event
- invitation
- security
- transactional
- legal
- support

| Category       | Description                                                      |
| -------------- | ---------------------------------------------------------------- |
| correspondence | General person-to-person or entity-to-entity messages            |
| billing        | Invoices, payment confirmations, payment failures                |
| marketing      | Promotional content, offers, newsletters                         |
| event          | Event invitations, reminders, updates, cancellations             |
| invitation     | RPP receipt invitation (see Section 9)                           |
| security       | Password resets, 2FA codes, login alerts, breach notifications   |
| transactional  | Order confirmations, shipping updates, appointment reminders     |
| legal          | Terms-of-service changes, compliance notices, regulatory filings |
| support        | Help desk replies, ticket updates, customer service follow-ups   |

Servers MAY support stricter local policy but SHOULD NOT redefine category
semantics for interoperable values listed above.

### 7.3 Content Rating Registry

Content ratings form a strict total order from least to most restrictive. The
receiver's max_content_rating on a receipt means "this level and everything
below it".

| Rating | Ordinal | Description                                         |
| ------ | ------- | --------------------------------------------------- |
| G      | 0       | General — suitable for all audiences                |
| PG     | 1       | Mildly sensitive — may reference sensitive topics   |
| M      | 2       | Mature — contains mature or professional themes     |
| R      | 3       | Restricted — contains explicit or sensitive content |

Enforcement rule: a message is accepted if and only if its content_rating
ordinal is less than or equal to the receipt's max_content_rating ordinal.

Example: a receipt with max_content_rating=PG permits messages rated G or PG but
MUST reject messages rated M or R.

### 7.4 Response

Successful submission MUST return HTTP 202 or HTTP 200 with:

```json
{
  "ok": true,
  "accepted": true,
  "message_id": "019644a1-7e2a-7b3c-8d1e-1f2a3b4c5d6e"
}
```

## 8. Reply Receipts

A sender MAY include a `reply_receipt` in a message. A reply receipt is a
standard receipt (Section 6.1) embedded in the message body that grants the
receiver permission to send one or more messages back to the sender — even if no
prior receiver-issued receipt existed in the reverse direction.

### 8.1 Reply Receipt Properties

A reply receipt is a full receipt and MUST include all required receipt fields
(Section 6.1): `id`, `secret`, `category`, `max_content_rating`, `usage_policy`,
`validity` constraints, and `interval_budget`.

The sender defines all terms on the reply receipt. There are no protocol-imposed
defaults or restrictions beyond those that apply to any receipt:

- The sender MAY set any `category` — it need not match the parent message's
  category. For example, a `billing` message may include a reply receipt
  permitting a `correspondence` response.
- The sender MAY set any `max_content_rating`.
- The sender MAY set any `usage_policy` (`one-time`, `multiple-time`, or
  `any-time`).
- The sender MAY set validity constraints, interval budgets, and expiration.

The receiver is never obligated to use, store, or honor a reply receipt. The
receiver MAY ignore it entirely.

### 8.2 Reply Receipt Validation

Reply receipts MUST be validated exactly like any other receipt. When the
receiver uses a reply receipt to send a message back to the original sender:

- The receiver's server includes the reply receipt's `id` in the
  `x-rpp-receipt-id` header and signs the request body with the reply receipt's
  `secret`.
- The original sender's server validates the signature, category, content
  rating, usage policy, and all other receipt constraints.
- If validation fails, the message is rejected with the standard error codes
  (Section 5.1).

### 8.3 Reply Receipt Chaining

A message sent using a reply receipt MAY itself include a new reply receipt.
This allows multi-turn conversations to develop naturally without either party
needing to go through the invitation flow. Each reply receipt in the chain is
independent — it does not inherit terms from any prior receipt.

Servers SHOULD NOT impose a protocol-level limit on reply chain depth. However,
servers MAY enforce local policy limits on the number of outstanding reply
receipts a user has issued.

### 8.4 Reply Receipt Revocation

Reply receipts follow the standard receipt lifecycle (Section 6.2). The sender
who issued the reply receipt MAY revoke it at any time using the standard
revocation mechanism (Section 10A.1). Once revoked, any message sent using the
reply receipt MUST be rejected with `RECEIPT_REVOKED`.

## 9. Invitations

Invitations are category=invitation messages that offer receipt grants.

There are two forms of invitation:

1. **Direct invitations** sent via the submit endpoint using an existing receipt
   (e.g., proposing an additional category to someone you already communicate
   with).
2. **Public invitations** created by a user and discoverable by invitation ID
   (Section 9.4). Public invitations are the primary mechanism for first contact
   between strangers.

Because RPP has no user-level addresses (Section 3A), invitations are not "sent
to an address." Direct invitations are delivered via receipt-based routing like
any other message. Public invitations are discovered out-of-band (QR code, link,
website) and accepted by the discovering party.

### 9.1 Receptive Policy

Receivers MUST explicitly opt in to invitations. A receiver MAY configure:

- receptive to all invitations,
- receptive by domain filter (Section 9.1.4),
- receptive for a limited time window (time-bounded receptivity),
- not receptive (closed).

If a receiver is not receptive per policy, invitation delivery MUST be rejected.

#### 9.1.1 Time-Bounded Receptivity

A receiver MAY open a receptive window that expires after a specified duration.
This is analogous to a Bluetooth pairing window: the receiver signals readiness
for a short period, after which the policy automatically reverts to its prior
state.

A time-bounded receptive policy MUST include:

- `receptive_until`: an ISO 8601 timestamp after which the policy expires,
- `scope`: any of the standard receptive filters (all, domain filter) that apply
  during the window.

Servers MUST reject invitations arriving after `receptive_until` with
`INVITATION_NOT_RECEPTIVE`.

Time-bounded receptivity is the RECOMMENDED mechanism for in-person exchanges
where two parties agree to communicate and need a brief mutual discovery window.

#### 9.1.2 Proximity Pairing

When two parties are co-located and wish to exchange invitations (e.g., two
phones), they SHOULD use the following flow:

1. Each party creates a time-bounded public invitation (RECOMMENDED: 60 second
   window) and shares it with the other via a local mechanism.
2. Each party discovers the other's public invitation (via QR code, NFC, or
   local broadcast) and accepts it.
3. Each party reviews the other's proposed terms and may accept, reject, or
   negotiate terms (see Section 9.3).
4. Accepted invitations produce receipts enabling future communication.

The mechanism by which parties discover each other's invitation ID during
proximity pairing (e.g., NFC, QR code, local broadcast) is outside the scope of
this specification. The protocol requires only that each party obtains the
other's invitation ID and RPP server domain.

#### 9.1.3 QR Code and URI-Based Opt-In

A sender (e.g., a place of business) MAY present a machine-readable invitation
link (QR code, NFC tag, deep link) that encodes:

- the sender's RPP domain,
- a public invitation ID referencing the full invitation details,
- an optional `expires_at` for the invitation.

The encoded URI MUST use the following scheme:

```
rpp://sender.example/invite?invitation_id=inv_abc123&expires_at=2026-04-02T12:00:00Z
```

When scanned or activated:

1. The receiver's client MUST fetch the full invitation details from the
   sender's RPP server using the invitation ID.
2. The receiver MUST be presented with the proposed terms before any receipt is
   issued.
3. The receiver MAY modify the terms of the receipt they grant — for example,
   accepting `billing` and `transactional` categories but declining `marketing`,
   or setting a `max_content_rating` of `G`, or limiting validity to 24 hours.
4. The modified receipt is issued under the receiver's authority. The sender
   receives only the receipt the receiver chose to grant, not necessarily what
   was proposed.

This flow MUST NOT auto-accept invitations. User confirmation is REQUIRED before
any receipt is issued.

#### 9.1.4 Domain Filters

A receiver MAY restrict invitation receptivity to specific domains using a
**domain filter**. A domain filter is an ordered list of `allow` or `block`
rules, each with a glob pattern. Rules are evaluated top-to-bottom and the first
matching rule wins. If no explicit rule matches, the domain is **blocked** — an
implicit `{ "action": "block", "pattern": "*" }` is always appended.

Domain patterns use **glob matching** against the sender's domain name:

| Character | Meaning                                               |
| --------- | ----------------------------------------------------- |
| `*`       | Matches zero or more characters within a single label |
| `**`      | Matches zero or more entire labels (including dots)   |
| `?`       | Matches exactly one character                         |

| Pattern                    | Matches                                                  |
| -------------------------- | -------------------------------------------------------- |
| `example.edu`              | Exactly `example.edu`                                    |
| `*.example-university.edu` | Any direct subdomain (e.g., `cs.example-university.edu`) |
| `**.edu`                   | Any domain ending in `.edu` at any depth                 |
| `mail-*.example.com`       | `mail-1.example.com`, `mail-prod.example.com`, etc.      |
| `*`                        | Any domain                                               |

Example domain filter:

```json
{
  "rules": [
    { "action": "block", "pattern": "spammer.example" },
    { "action": "allow", "pattern": "*.example-university.edu" },
    { "action": "allow", "pattern": "**.gov" }
  ]
}
```

This filter blocks `spammer.example`, allows any direct subdomain of
`example-university.edu`, allows any `.gov` domain at any depth, and blocks
everything else (implicit fallthrough).

Rules:

- Glob patterns are matched against the full domain name. Matching is
  case-insensitive.
- `*` MUST NOT match the dot (`.`) label separator. `*.example.com` matches
  `mail.example.com` but not `a.b.example.com`. Use `**` to match across label
  boundaries.
- An empty rules list blocks all domains (the implicit fallthrough applies). To
  allow all domains, add a single rule: `{ "action": "allow", "pattern": "*" }`.
- Domain filters are evaluated by the receiving server at invitation delivery
  time. The sender's `sender_domain` in the invitation envelope is matched
  against the rules.

### 9.2 Invitation Lifecycle

An invitation MUST include:

- invitation_id,
- offered receipt terms,
- expires_at timeout set by sender.

Invitation state transitions:

- pending -> accepted
- pending -> rejected
- pending/accepted -> cancelled (sender action)
- pending -> expired

When an invitation is cancelled, all receipts derived from that invitation MUST
be invalidated.

### 9.3 Invitation Term Negotiation

When a receiver receives an invitation, they are not obligated to accept the
proposed terms as-is. The receiver MAY issue a receipt with narrower terms than
those proposed in the invitation. Specifically, the receiver MAY:

- accept only a subset of proposed categories,
- set a lower `max_content_rating` than proposed,
- apply stricter usage policies (e.g., `one-time` instead of `any-time`),
- set a shorter validity window or tighter interval budget,
- add time-of-day or day-of-week restrictions not present in the proposal.

The receiver MUST NOT grant broader permissions than they are comfortable with.
The resulting receipt reflects the receiver's decisions, not the sender's
preferences.

If the invitation proposes multiple categories and the receiver accepts only
some, the server MUST issue separate receipts per accepted category (one receipt
per category, per Section 6.1).

The sender MUST treat the issued receipt as authoritative. If the sender
requires broader terms, they may send a new invitation proposing different
conditions, subject to the receiver's receptive policy.

### 9.4 Public Invitations

A user MAY create a **public invitation** — a standing offer that can be
discovered and accepted by anyone who obtains the invitation ID. Public
invitations are the primary first-contact mechanism in RPP, replacing the need
for user-level addresses.

#### 9.4.1 Public Invitation Properties

A public invitation MUST include:

| Property        | Required | Description                                       |
| --------------- | -------- | ------------------------------------------------- |
| invitation_id   | REQUIRED | Unique identifier for this invitation             |
| domain          | REQUIRED | The RPP domain hosting this invitation            |
| display_name    | OPTIONAL | Any Unicode string the creator wants to present   |
| description     | OPTIONAL | Freeform text describing the invitation's purpose |
| proposed_terms  | REQUIRED | The receipt terms offered to acceptors            |
| domain_filter   | OPTIONAL | Domain filter restricting who may accept (9.1.4)  |
| max_acceptances | OPTIONAL | Maximum number of times this invitation can be    |
|                 |          | accepted. If omitted, unlimited.                  |
| expires_at      | OPTIONAL | ISO 8601 timestamp after which the invitation     |
|                 |          | is no longer valid.                               |
| created_at      | REQUIRED | ISO 8601 timestamp of creation                    |
| verification    | OPTIONAL | Domain verification attestation (see Section 9.5) |

The `display_name` and `description` fields are the creator's public-facing
presentation. They MAY contain any Unicode text the user chooses — their real
name, a pseudonym, an organization name, an emoji, or any other string. These
fields are for human consumption only and MUST NOT be used for routing or
authentication.

#### 9.4.2 Public Invitation Discovery

Public invitations are discovered out-of-band. The protocol does not mandate a
discovery mechanism, but the following are RECOMMENDED:

- **QR code or NFC tag** encoding an `rpp://` URI (Section 9.1.3).
- **Direct link** shared via website, social media, or any external channel.
- **Domain invitation directory** — a domain MAY expose an endpoint listing
  public invitations for its users. This is OPTIONAL and the format is
  implementation-defined.

A public invitation MUST be fetchable by invitation ID from the hosting domain's
RPP server. The RECOMMENDED endpoint is:

```
GET /rpp/v1/invitations/{invitation_id}
```

This endpoint MUST NOT require authentication. The response MUST be the public
invitation object as JSON.

#### 9.4.3 Public Invitation Acceptance

When a party discovers a public invitation and wishes to accept it:

1. The accepting party's client fetches the public invitation from the hosting
   domain.
2. If the invitation has a `domain_filter`, the hosting server evaluates the
   acceptor's domain against the filter rules (Section 9.1.4). If the domain
   does not match an `allow` rule, the acceptance MUST be rejected with
   `INVITATION_NOT_RECEPTIVE`.
3. The accepting party reviews the proposed terms and MAY negotiate narrower
   terms per Section 9.3.
4. The hosting server issues a receipt to the accepting party's domain.
5. The acceptor MAY include a voluntary display name with their acceptance,
   which is attached to the receipt for the invitation creator's reference.

Public invitation acceptance is subject to the standard invitation lifecycle
(Section 9.2). The `max_acceptances` limit, if set, MUST be enforced — once
reached, further acceptances MUST be rejected.

#### 9.4.4 Public Invitation Management

- The creator MAY cancel a public invitation at any time. Cancellation follows
  the standard lifecycle (Section 9.2).
- The creator MAY update `display_name`, `description`, or `domain_filter` on a
  public invitation without changing the invitation_id. Changes apply only to
  future acceptances — existing receipts derived from prior acceptances are
  unaffected.
- The creator MUST NOT alter `proposed_terms` on an existing public invitation.
  To offer different terms, the creator MUST create a new public invitation and
  optionally cancel the old one.

### 9.5 Domain-Verified Invitations

When evaluating invitations — especially from unfamiliar domains — the receiving
party may see a display name like "Dr. Alice Smith" but has no way to verify the
_person_ behind the invitation. A display name is meaningless if the domain
server has not confirmed that the user behind the invitation is actually Dr.
Alice Smith.

Domain-verified invitations solve this by allowing the hosting domain's server
to cryptographically attest that the invitation's metadata matches the server's
own records for the user.

#### 9.5.1 Domain Verification Key

To support invitation verification, an RPP server MUST publish a public key in
its domain identity endpoint (Section 12.1). The `public_key` field MUST
contain:

| Field     | Required | Description                                                      |
| --------- | -------- | ---------------------------------------------------------------- |
| algorithm | REQUIRED | Signing algorithm. MUST be `Ed25519`.                            |
| key       | REQUIRED | Base64-encoded public key in SubjectPublicKeyInfo (SPKI) format. |

Servers SHOULD use Ed25519 for verification signatures. The corresponding
private key MUST be kept secret and used only for signing verification
attestations.

If a domain rotates its verification key, previously issued verification
signatures become unverifiable. Servers SHOULD include a `key_id` in the
verification object (Section 9.5.2) and MAY serve historical keys at an
implementation-defined endpoint to allow verification of older invitations.

#### 9.5.2 Verification Attestation

When a user creates a public invitation, the hosting server MAY attach a
`verification` object that attests the user's metadata has been checked against
the server's records.

The `verification` object MUST have the following shape:

```json
{
  "verification": {
    "verified_fields": {
      "display_name": "Dr. Alice Smith",
      "description": "Computer Science Department, Example University"
    },
    "verified_at": "2026-04-01T10:00:00Z",
    "domain": "cs.example-university.edu",
    "key_id": "key_2026_04",
    "signature": "base64-encoded-Ed25519-signature"
  }
}
```

| Field           | Required | Description                                               |
| --------------- | -------- | --------------------------------------------------------- |
| verified_fields | REQUIRED | The metadata fields the domain is attesting to            |
| verified_at     | REQUIRED | ISO 8601 timestamp of when verification was performed     |
| domain          | REQUIRED | The domain performing the attestation                     |
| key_id          | OPTIONAL | Identifier of the signing key, for key rotation           |
| signature       | REQUIRED | Ed25519 signature over the canonical verification payload |

The signature MUST be computed over the following canonical payload, serialized
as a JSON object with keys sorted alphabetically and no extraneous whitespace:

```json
{
  "domain": "cs.example-university.edu",
  "invitation_id": "inv_abc123",
  "verified_at": "2026-04-01T10:00:00Z",
  "verified_fields": {
    "description": "Computer Science Department, Example University",
    "display_name": "Dr. Alice Smith"
  }
}
```

The canonical payload MUST include:

- `domain`: the attesting domain
- `invitation_id`: the invitation this attestation applies to
- `verified_at`: the attestation timestamp
- `verified_fields`: the attested metadata, with keys sorted alphabetically

#### 9.5.3 Verification Rules

- The server MUST only sign fields whose values match the server's own records
  for the user. If a user's display name in the server's database is "Alice
  Smith" but the invitation says "Bob Jones", the server MUST NOT sign the
  invitation.
- The server MAY verify any subset of invitation metadata fields. Only fields
  present in `verified_fields` are attested. Fields not listed are unverified
  and SHOULD be treated as self-declared by the receiver.
- The server MUST re-verify and re-sign if the user updates any verified field
  on the invitation. If the user changes their display name on an invitation,
  the old signature becomes invalid and the server MUST produce a new one — or
  remove the `verification` object entirely.
- A server MUST NOT produce a verification attestation for fields it has no
  ability to verify (e.g., if the server does not collect real names, it cannot
  verify `display_name`).

#### 9.5.4 Verification by the Receiving Party

When a receiving party encounters an invitation with a `verification` object,
they SHOULD verify the attestation:

1. Fetch the domain's public key from `/.well-known/rpp-domain-identity` on the
   attesting domain.
2. Reconstruct the canonical verification payload from the invitation's
   `invitation_id`, `verification.domain`, `verification.verified_at`, and
   `verification.verified_fields`.
3. Verify the Ed25519 signature against the reconstructed payload using the
   domain's public key.
4. If verification succeeds, the receiving party MAY treat the `verified_fields`
   as domain-attested — meaning the domain server has confirmed these values
   match its records.
5. If verification fails, the receiving party MUST treat all metadata as
   unverified self-declaration.

Verification is informational. A successful verification means the domain server
attests the metadata is accurate in its records — it does NOT mean the metadata
is true in any absolute sense. A domain could have incorrect records. Trust in
the verification is therefore bounded by trust in the domain itself.

#### 9.5.5 When Verification is RECOMMENDED

- Invitations intended for professional or institutional contexts (e.g.,
  academic correspondence, business inquiries) SHOULD include domain
  verification of at least the `display_name` field.
- Invitations with a `domain_filter` that restricts acceptance to specific
  domains SHOULD include domain verification so that the accepting party can
  assess the person, not just the domain.
- Casual or pseudonymous invitations (e.g., social, personal) MAY omit
  verification entirely.

## 10. Group Conversations

A group conversation is a lightweight coordination layer over the existing
receipt model. There are no group admins, no moderation roles, and no ability to
remove another member. A group is simply a shared receipt and a member list.

### 10.1 Group Model

A group is identified by a `group_id` (UUIDv7) and consists of:

| Property   | Required | Description                                         |
| ---------- | -------- | --------------------------------------------------- |
| group_id   | REQUIRED | Unique identifier for this group                    |
| group_name | OPTIONAL | Display name for the group (any Unicode string)     |
| category   | REQUIRED | The message category for all messages in this group |
| receipt    | REQUIRED | A shared receipt (id + secret) used by all members  |
| members    | REQUIRED | List of member domains and optional display names   |
| supersedes | OPTIONAL | group_id of the group this one replaces             |
| created_at | REQUIRED | ISO 8601 timestamp of creation                      |

Every member holds the same receipt — one `receipt_id` and one `secret` for the
entire group. The receipt's `category`, `max_content_rating`, and other
constraints apply to all messages in the group.

### 10.2 Creating a Group

Any user may create a group. The creator's server generates the `group_id` and a
shared receipt (id + secret), then sends a group invitation to each prospective
member.

A group invitation is a `category=invitation` message that includes:

- The `group_id`, `group_name`, `category`, and shared receipt details.
- The full member list (all domains and optional display names).
- An optional `supersedes` field referencing a prior group.

Group invitations are delivered using whatever receipts the creator already
holds for each invitee — or via public invitations if no prior relationship
exists.

### 10.3 Joining a Group

When a user accepts a group invitation:

1. Their server stores the shared receipt and member list.
2. The user becomes an active member and can immediately send and receive group
   messages.

There is no requirement that all members accept before the group becomes usable.
Each member can send and receive as soon as they have joined. Messages sent
before a member joins are not visible to that member.

### 10.4 Sending Group Messages

When a user sends a message to a group, the message envelope includes a
`group_id` field:

```json
{
  "message_id": "019644a1-7e2a-7b3c-8d1e-1f2a3b4c5d6e",
  "sender_domain": "alice.example",
  "sender_display_name": "Alice",
  "group_id": "019644a1-9a1b-7d4e-8f2a-3b4c5d6e7f8a",
  "category": "correspondence",
  "content_rating": "G",
  "sent_at": "2026-04-04T12:00:00Z",
  "subject": "Team sync",
  "body": {
    "content_type": "text/markdown",
    "content": "Hey all, quick update..."
  },
  "reply_receipt": null,
  "metadata": {}
}
```

The sender's server MUST deliver the message to **every** other member's domain
using the shared group receipt. The server MUST NOT allow the sender to select a
subset of recipients — group messages go to all members or no one.

Each delivery is an independent HTTP POST to the receiving domain's submit
endpoint. The `x-rpp-receipt-id` header contains the shared group receipt ID,
and the `x-rpp-signature` is computed using the shared group secret.

**Receiving server validation:** When a receiving server receives a message with
a `group_id`, it MUST verify:

1. The `group_id` matches a group the server knows about.
2. The shared receipt ID and HMAC signature are valid.
3. The `sender_domain` is in the group's member list.
4. The `sender_domain` matches the domain originating the TLS connection.

If any check fails, the server MUST reject the message.

Reply receipts MUST NOT be included in group messages. Multi-party reply receipt
semantics are undefined and would undermine the group model.

### 10.5 Leaving a Group

Any member may leave a group at any time without approval from other members.

When a member leaves:

1. Their server removes the group from local storage and stops delivering group
   messages to the user.
2. Other members discover the departure when their next group message delivery
   to that member's domain is rejected.
3. Sending servers SHOULD remove unresponsive members from their local member
   list after a delivery failure. This is a local optimization — it does not
   affect other members' view of the group.

There is no departure notification. Leaving is silent and immediate. There is no
mechanism to prevent a member from leaving or to require approval.

### 10.6 Adding Members

To add a member to a group, any existing member creates a **new group** that
supersedes the old one:

1. The member creates a new group with a new `group_id`, new shared receipt, the
   existing member list plus the new member, and `supersedes` set to the old
   `group_id`.
2. The member sends group invitations for the new group to all members (existing
   and new).
3. Members who accept the new group invitation SHOULD archive the superseded
   group. Clients SHOULD present the conversation history from the old group as
   continuous with the new one.

This model ensures:

- Every member explicitly consents to each group they join.
- There are no silent membership changes. A new group is a new invitation that
  each member independently accepts or ignores.
- No one can be forcibly added to a group — they must accept the invitation.

Members who do not accept the new group invitation remain in the old group
(which continues to function) and are not part of the new one.

### 10.7 Group Constraints

- **No kicking.** There is no mechanism to remove another member from a group.
  You may leave a group yourself. If you want a group without a particular
  member, create a new group and invite only the members you want.
- **No admin or moderator roles.** All members have identical capabilities:
  send, leave, or create a superseding group.
- **No subset sending.** The protocol enforces all-or-nothing delivery within a
  group.
- **One category per group.** All messages in a group share the category and
  content rating constraints defined in the group receipt.
- **Message ordering.** RPP does not guarantee cross-domain message ordering.
  Clients SHOULD use `sent_at` timestamps to present messages in chronological
  order.
- **No hard member cap.** Group size is not limited by the protocol. Each
  message requires O(N) deliveries (one per member), which provides natural
  back-pressure for very large groups.

## 10A. Receipt Management (MCP)

The MCP endpoint MUST expose tools for receipt lifecycle management. These tools
are available to authenticated listeners connected to their own RPP server.

### 10A.1 Receipt Revocation

Listeners MUST be able to revoke any receipt they have previously issued. A
revocation request MUST include:

- receipt_id: the receipt to revoke,
- reason: a structured revocation reason.

Revocation reasons are drawn from a fixed set:

| Reason Code        | Description                                             |
| ------------------ | ------------------------------------------------------- |
| SENDER_REQUEST     | Receiver chose to revoke at their own discretion        |
| CATEGORY_VIOLATION | Sender sent content that did not match the category     |
| RATING_VIOLATION   | Sender sent content exceeding the agreed rating         |
| SPAM               | Sender abused the receipt for unsolicited-style content |
| ABUSE              | Sender sent harassing, threatening, or harmful content  |
| OTHER              | Receiver-specified freeform reason                      |

- reason_detail: an OPTIONAL human-readable string providing additional context.
- Revocation MUST be immediate: once acknowledged, the receipt status becomes
  revoked and subsequent submit requests using it MUST return RECEIPT_REVOKED.
- The server SHOULD record the revocation reason for audit and policy purposes.
- Revocation of a receipt derived from an invitation does not automatically
  cancel the invitation unless the receiver explicitly cancels it.

### 10A.2 Bulk Revocation

Listeners MAY revoke all receipts matching a filter:

- by sender identity,
- by category,
- by invitation_id (revokes all receipts derived from that invitation).

Bulk revocation MUST apply the same reason semantics as single revocation.

### 10A.3 Revocation Discovery

RPP does not deliver revocation notifications. When a receipt is revoked, the
revocation takes effect immediately on the receiving server. The sender
discovers the revocation when their next message submission is rejected with
`RECEIPT_REVOKED`.

Senders MUST treat receipt validity as uncertain and handle `RECEIPT_REVOKED`
errors gracefully at any time. A sender MUST NOT assume that a receipt is still
valid simply because no error has been received — the receipt may have been
revoked since the last successful submission.

### 10A.4 Receipt Renewal

When a receiver wishes to change the terms under which a sender may communicate,
they revoke the existing receipt and issue a replacement. This is performed as a
single atomic operation via the `renew_receipt` MCP tool (Section 10B.2).

The replacement receipt is a new, independent receipt with its own `id` and
`secret`. It does not inherit the usage count, history, or identity of the
revoked receipt.

Because RPP does not deliver revocation notifications, the sender discovers the
change when their next message is rejected with `RECEIPT_REVOKED`. To deliver
the replacement receipt to the sender, the receiver has two options:

1. **Send via an existing receipt in the reverse direction.** If the receiver
   holds a receipt from the sender (e.g., from a reply receipt or prior
   invitation), the receiver MAY send a message containing the replacement
   receipt details.
2. **Out-of-band delivery.** The receiver MAY communicate the new receipt
   through any external channel. This is analogous to how initial invitations
   are discovered.

If neither option is available, the sender must re-establish communication
through the invitation flow.

- The old receipt MUST be immediately revoked upon issuance of the replacement.
- The sender SHOULD begin using the replacement receipt for subsequent messages.
- If no replacement is issued, the revocation is terminal and no further
  communication under the revoked receipt's category is permitted unless a new
  receipt is obtained through the invitation flow.

## 10B. MCP Tool Catalog

This section defines the RECOMMENDED MCP tools an RPP server SHOULD expose to
authenticated listeners. Tools are grouped by role: **listener tools** are
available to any authenticated user, while **domain management tools** require
the domain administrator role. Servers MAY combine, rename, or extend these
tools, but the capabilities described here represent the minimum surface area
needed to implement the features defined in this specification.

All tools are invoked over the MCP endpoint (Section 4.1) and require OAuth 2.1
bearer token authentication (Section 5.2).

### 10B.0 Tool Output Format

All MCP tools that return structured data MUST declare an `outputSchema` (JSON
Schema) describing the shape of the result. Tool results MUST include both:

1. **`structuredContent`** — The structured result object, conforming to the
   declared `outputSchema`. Clients that support structured output SHOULD use
   this field directly.
2. **`content`** — A `type: "text"` content item containing the JSON-serialized
   `structuredContent`. This provides backwards compatibility with clients that
   do not support `structuredContent` and serves as a text representation for
   LLM consumption.

Servers MUST NOT return raw unstructured text when the result is structured
data.

### 10B.1 Messaging Tools

These tools allow listeners to send and receive messages through their own RPP
server.

| Tool             | Description                                                               |
| ---------------- | ------------------------------------------------------------------------- |
| `send_message`   | Compose and send a message using a held receipt. The server performs HMAC |
|                  | signing and HTTP POST to the receiver's domain on behalf of the listener. |
| `list_messages`  | List messages in the listener's inbox, with filters for category, sender  |
|                  | domain, date range, and read/unread status.                               |
| `get_message`    | Retrieve a single message by message_id.                                  |
| `mark_read`      | Mark one or more messages as read.                                        |
| `delete_message` | Delete a message from the listener's local store. Does not affect the     |
|                  | sender's copy.                                                            |

### 10B.2 Group Tools

These tools manage group conversations (Section 10).

| Tool                  | Description                                                            |
| --------------------- | ---------------------------------------------------------------------- |
| `create_group`        | Create a new group: generates group_id and shared receipt, sends group |
|                       | invitations to all specified members. Optionally supersedes a prior    |
|                       | group.                                                                 |
| `list_groups`         | List the listener's active groups, with filters for category and       |
|                       | member count.                                                          |
| `get_group`           | Retrieve details of a group: group_id, name, members, category,        |
|                       | receipt constraints, and supersedes reference.                         |
| `send_group_message`  | Send a message to all members of a group (Section 10.4). The server    |
|                       | handles fan-out to all member domains.                                 |
| `leave_group`         | Leave a group (Section 10.5). Stops delivery and removes the group     |
|                       | from the listener's active groups.                                     |
| `list_group_messages` | List messages in a group conversation, with filters for date range     |
|                       | and sender domain.                                                     |

### 10B.3 Receipt Tools

These tools manage receipts the listener has issued (as receiver) and receipts
the listener holds (as sender).

| Tool                   | Description                                                              |
| ---------------------- | ------------------------------------------------------------------------ |
| `list_issued_receipts` | List receipts the listener has issued to other domains, with filters for |
|                        | category, sender domain, and status (active, revoked, expired).          |
| `list_held_receipts`   | List receipts the listener holds from other domains, with the same       |
|                        | filter options.                                                          |
| `get_receipt`          | Retrieve full details of a single receipt by receipt_id.                 |
| `revoke_receipt`       | Revoke a single issued receipt (Section 10A.1).                          |
| `bulk_revoke_receipts` | Revoke all issued receipts matching a filter (Section 10A.2).            |
| `renew_receipt`        | Revoke an issued receipt and atomically issue a replacement with new     |
|                        | terms (Section 10A.4).                                                   |

### 10B.4 Invitation Tools

These tools manage the invitation lifecycle for both direct and public
invitations.

| Tool                       | Description                                                             |
| -------------------------- | ----------------------------------------------------------------------- |
| `list_invitations`         | List pending, accepted, rejected, and expired invitations the listener  |
|                            | has received, with filters for sender domain and status.                |
| `review_invitation`        | Retrieve full details of a pending invitation including proposed terms. |
| `accept_invitation`        | Accept a pending invitation, optionally with narrower terms per         |
|                            | Section 9.3. Issues a receipt to the inviting domain.                   |
| `reject_invitation`        | Reject a pending invitation.                                            |
| `send_invitation`          | Send a direct invitation via an existing receipt to propose additional  |
|                            | categories or new terms to an existing contact.                         |
| `create_public_invitation` | Create a public invitation (Section 9.4) with proposed terms,           |
|                            | optional display name, description, trust gate, and expiration.         |
| `update_public_invitation` | Update mutable fields on a public invitation (display_name,             |
|                            | description, domain_filter) per Section 9.4.4.                          |
| `cancel_public_invitation` | Cancel a public invitation. Receipts from prior acceptances remain      |
|                            | valid unless individually revoked.                                      |
| `list_public_invitations`  | List the listener's own public invitations, with filters for status.    |
| `fetch_public_invitation`  | Fetch a remote public invitation by domain and invitation_id. Returns   |
|                            | the invitation object including any verification attestation.           |
| `accept_public_invitation` | Accept a remote public invitation, optionally with narrower terms.      |
|                            | The server validates any domain_filter and issues a receipt to the      |
|                            | hosting domain.                                                         |

### 10B.5 Receptive Policy Tools

These tools manage the listener's receptive policy for incoming invitations
(Section 9.1).

| Tool                    | Description                                                        |
| ----------------------- | ------------------------------------------------------------------ |
| `get_receptive_policy`  | Retrieve the listener's current receptive policy configuration.    |
| `set_receptive_policy`  | Update the receptive policy. Supports all modes: receptive to all, |
|                         | by domain filter (Section 9.1.4), or closed.                       |
| `open_receptive_window` | Create a time-bounded receptive window (Section 9.1.1) with a      |
|                         | specified duration and scope. RECOMMENDED for proximity pairing.   |

### 10B.6 Identity Tools

These tools manage the listener's display name and identity presentation.

| Tool                         | Description                                                |
| ---------------------------- | ---------------------------------------------------------- |
| `get_display_name`           | Retrieve the listener's current default display name.      |
| `set_display_name`           | Set or clear the listener's default display name (Section  |
|                              | 3A.2).                                                     |
| `set_user_verified_metadata` | Refresh the caller's `user_verified_fields` from the       |
|                              | authenticated token claims. The tool MUST replace the      |
|                              | prior user-sourced map with the current token-derived      |
|                              | values and MUST NOT modify `admin_verified_fields`.        |

### 10B.7 Domain Management — Identity and Configuration

The following tools require the domain administrator role. They manage the
domain's public identity, verification key, and server-level configuration.

| Tool                      | Description                                                         |
| ------------------------- | ------------------------------------------------------------------- |
| `get_domain_identity`     | Retrieve the current domain identity (Section 12.1) as it appears   |
|                           | at `/.well-known/rpp-domain-identity`.                              |
| `update_domain_identity`  | Update domain identity fields: display_name, domain_type,           |
|                           | parent_domain, categories_offered, contact_policy_url.              |
| `rotate_verification_key` | Generate a new Ed25519 keypair for domain-verified invitations      |
|                           | (Section 9.5.1). Archives the previous key. Existing verification   |
|                           | attestations signed with the old key become unverifiable unless the |
|                           | server serves historical keys.                                      |
| `get_verification_key`    | Retrieve the current public verification key and key_id.            |
| `list_historical_keys`    | List archived verification keys with their key_id and archived_at   |
|                           | timestamp. Used to support verification of older attestations. This |
|                           | tool MUST support resume-token pagination (Section 10B.10).         |
| `delete_historical_key`   | Remove an archived verification key by key_id. Attestations signed  |
|                           | with the deleted key become permanently unverifiable.               |

### 10B.8 Domain Management — User Verification

These tools allow the domain administrator to manage the verified metadata
records that the server checks when automatically attesting public invitations
(Section 9.5). When a user creates or updates a public invitation, the server
compares the invitation's metadata against these records and automatically
produces (or strips) the `verification` object — no manual attestation step is
required.

Verified metadata has two distinct sources:

- `user_verified_fields`: values derived from the user's authenticated identity
  token.
- `admin_verified_fields`: values supplied by a domain administrator.

When the same field exists in both sources, the admin value is authoritative in
the merged `verified_fields` view used by the server for verification and MCP
tool responses that expose the effective record.

| Tool                         | Description                                                        |
| ---------------------------- | ------------------------------------------------------------------ |
| `list_verifiable_users`      | List users whose metadata the server can verify, along with the    |
|                              | verifiable fields (e.g., display_name) and their current values.   |
|                              | This tool MUST support resume-token pagination (Section 10B.10).   |
| `get_user_verified_metadata` | Retrieve the verified metadata record for a specific user,         |
|                              | including `user_verified_fields`, `admin_verified_fields`, the     |
|                              | effective merged `verified_fields`, and update timestamps.         |
| `set_admin_verified_metadata` | Set or update admin-supplied verified metadata for a user. These  |
|                               | values populate `admin_verified_fields` and override conflicting  |
|                               | user-sourced values in the effective merged record used during    |
|                               | automatic attestation (Section 9.5.3).                            |
| `remove_admin_verified_metadata` | Remove a specific field from a user's admin verified metadata. |
|                                  | The server MUST automatically re-sign or strip the            |
|                                  | `verification` object on any active invitation that          |
|                                  | referenced the removed field.                                |

### 10B.9 Domain Management — Contact Information

These tools manage the domain's out-of-band contact information published in the
domain identity endpoint (Section 12).

| Tool                     | Description                                                     |
| ------------------------ | --------------------------------------------------------------- |
| `get_contact_policy_url` | Retrieve the current `contact_policy_url` from domain identity. |
| `set_contact_policy_url` | Set or update the `contact_policy_url`. This is the sole        |
|                          | out-of-band channel for domain administrator communication.     |

### 10B.10 Pagination for List Tools

All MCP tools that return potentially unbounded lists MUST use
resume-token-based pagination. Offset-based pagination (e.g., `offset`,
`page`) MUST NOT be used.

The following conventions apply to list-style tools (including but not limited
to `list_historical_keys` and `list_verifiable_users`):

- Request parameters:
  - `page_size` (optional integer): number of entries requested.
  - `resume_token` (optional string): opaque token returned by a prior call.
- Response shape:
  - `<items_field>`: tool-specific array payload (e.g., `keys`, `users`).
  - `next_resume_token` (optional string): opaque token for the next page.
    If absent, there are no more results.

Example request:

```json
{
  "page_size": 100,
  "resume_token": "eyJrZXkiOiJhYmMifQ"
}
```

Example response:

```json
{
  "users": [
    {
      "oid": "8c946dc0-a255-4757-8b28-52a81072a784",
      "verified_fields": {
        "name": "Justin Chase"
      }
    }
  ],
  "next_resume_token": "eyJrZXkiOiJkZWYifQ"
}
```

Rules:

- Resume tokens MUST be treated as opaque by clients.
- Servers MAY encode implementation details in tokens, but clients MUST NOT
  rely on token structure.
- Servers SHOULD provide a stable traversal order per tool.
- Servers MUST reject malformed or expired tokens with a stable MCP error code
  (Section 11.3).

## 11. Error Model

All error responses MUST use content-type application/json and the following
shape:

```json
{
  "ok": false,
  "error": {
    "code": "RECEIPT_CATEGORY_MISMATCH",
    "message": "Receipt category billing does not permit category marketing."
  }
}
```

- The code field MUST be one of the registered RPP error codes.
- The message field SHOULD be a human-readable explanation and MAY vary between
  implementations.

### 11.1 RPP Error Code Registry

The normative mapping of RPP error codes to HTTP status codes is defined in
Section 5.1 for the submit endpoint. The full registry is reproduced here for
reference:

| RPP Error Code            | HTTP | Description                                        |
| ------------------------- | ---- | -------------------------------------------------- |
| MISSING_RECEIPT_ID        | 400  | x-rpp-receipt-id header absent                     |
| MISSING_SIGNATURE         | 400  | x-rpp-signature header absent                      |
| MISSING_TIMESTAMP         | 400  | x-rpp-timestamp header absent                      |
| MALFORMED_RECEIPT_ID      | 400  | x-rpp-receipt-id value cannot be parsed            |
| MALFORMED_SIGNATURE       | 400  | x-rpp-signature value cannot be parsed             |
| MALFORMED_TIMESTAMP       | 400  | x-rpp-timestamp value cannot be parsed             |
| INVALID_REQUEST_BODY      | 400  | Request body is not valid JSON                     |
| INVALID_MESSAGE_ENVELOPE  | 400  | Required envelope fields missing or invalid        |
| REQUEST_STALE             | 400  | Timestamp exceeds 60-second freshness window       |
| DUPLICATE_MESSAGE         | 400  | message_id already accepted within dedup window    |
| RECEIPT_NOT_FOUND         | 403  | Receipt id not recognized                          |
| RECEIPT_INVALID_SIGNATURE | 403  | HMAC signature verification failed                 |
| RECEIPT_REVOKED           | 403  | Receipt has been revoked by the receiver           |
| RECEIPT_EXPIRED           | 403  | Receipt has passed its expiration time             |
| RECEIPT_USAGE_EXHAUSTED   | 403  | Receipt usage count fully consumed                 |
| RECEIPT_TIME_RESTRICTED   | 403  | Request arrived outside allowed time window        |
| RECEIPT_INTERVAL_EXCEEDED | 403  | Interval budget for this receipt has been exceeded |
| RECEIPT_CATEGORY_MISMATCH | 403  | Message category does not match receipt category   |
| RECEIPT_RATING_EXCEEDED   | 403  | Content rating exceeds receipt max_content_rating  |
| MISSING_CONTENT_RATING    | 400  | content_rating field missing or not a valid rating |
| INVITATION_NOT_RECEPTIVE  | 403  | Receiver is not receptive to invitations           |
| INVITATION_EXPIRED        | 409  | Referenced invitation has expired                  |
| INVITATION_CANCELLED      | 409  | Referenced invitation has been cancelled           |
| MESSAGE_TOO_LARGE         | 413  | Request body exceeds 256 KB protocol limit         |
| GROUP_NOT_FOUND           | 403  | group_id not recognized by this server             |
| GROUP_SENDER_NOT_MEMBER   | 403  | sender_domain is not in the group's member list    |
| INTERNAL_ERROR            | 500  | Unexpected server-side failure                     |

### 11.2 MCP Endpoint Error Structures

RPP MCP endpoints use two error layers:

1. HTTP/MCP endpoint authentication and request setup failures.
2. Tool execution failures returned through MCP tool results.

#### 11.2.1 HTTP/MCP Authentication Error Envelope

When the `/mcp` endpoint rejects a request before tool execution (for example,
authentication or token validation failure), the response MUST be JSON with the
following shape:

```json
{
  "ok": false,
  "error": "Insufficient scope",
  "code": "E_INSUFFICIENT_SCOPE",
  "metadata": {
    "expectedAnyOf": ["api://.../rpp.tools.read"]
  }
}
```

- `code` MUST be one of the MCP auth codes in Section 11.3.
- `metadata` MAY be omitted when not needed.

#### 11.2.2 MCP Tool Error Envelope

When a tool executes but fails with an application error, the MCP tool response
MUST set `isError: true` and return structured JSON containing:

```json
{
  "ok": false,
  "error": {
    "name": "AccountNotFoundError",
    "status": 404,
    "code": "E_ACCOUNT_NOT_FOUND",
    "message": "No registered account found for oid ..."
  }
}
```

- `error.code` MUST be one of the MCP tool error codes in Section 11.3.
- `error.status` SHOULD map to an equivalent HTTP semantics for diagnostics.

#### 11.2.3 JSON-RPC/MCP Protocol Errors

Implementations MUST surface protocol-level JSON-RPC errors using standard
JSON-RPC numeric error codes.

| Code   | Meaning          |
| ------ | ---------------- |
| -32700 | Parse error      |
| -32600 | Invalid request  |
| -32601 | Method not found |
| -32602 | Invalid params   |
| -32603 | Internal error   |

### 11.3 MCP Error Code Registry

#### 11.3.1 MCP Authentication and Request Codes

| MCP Code                      | Typical HTTP | Description                                  |
| ----------------------------- | ------------ | -------------------------------------------- |
| E_MISSING_HEADER              | 401          | Authorization header is missing              |
| E_INVALID_FORMAT              | 401          | Authorization header format is invalid       |
| E_NOT_CONFIGURED              | 500          | Auth system is not configured                |
| E_INVALID_ORIGIN              | 400          | Origin header is invalid or mismatched       |
| E_MISSING_OID                 | 401          | Required `oid` claim is absent               |
| E_INVALID_TOKEN_FORMAT        | 401          | JWT structure is invalid                     |
| E_EXPIRED                     | 401          | Token is expired                             |
| E_NOT_YET_VALID               | 401          | Token `nbf` is in the future                |
| E_INVALID_ISSUER              | 401          | Token issuer does not match expected issuer  |
| E_INVALID_AUDIENCE            | 401          | Token audience does not match expected       |
| E_KEY_NOT_FOUND               | 401          | Signing key could not be resolved            |
| E_JWKS_FETCH_FAILED           | 500          | JWKS retrieval failed                        |
| E_INSUFFICIENT_SCOPE          | 403          | Required MCP scopes are missing              |
| E_UNSUPPORTED_ALGORITHM       | 400          | JWT algorithm is not supported               |
| E_INVALID_KEY_FORMAT          | 400          | JWKS key payload is malformed                |
| E_INVALID_SIGNATURE           | 401          | JWT signature validation failed              |
| E_SIGNATURE_VERIFICATION_FAILED | 401        | Signature verification process failed        |

#### 11.3.2 MCP Tool/Application Error Codes

| MCP Tool Code                    | Typical HTTP | Description                                              |
| -------------------------------- | ------------ | -------------------------------------------------------- |
| E_INTERNAL                       | 500          | Unexpected tool failure                                  |
| E_ACCOUNT_NOT_FOUND              | 404          | Target account does not exist                            |
| E_USER_VERIFIED_METADATA_NOT_FOUND | 404        | No verified metadata exists for the requested user       |
| E_INVALID_RESUME_TOKEN           | 400          | Pagination resume token is malformed or expired          |
| E_INVALID_PAGE_SIZE              | 400          | Pagination page_size is invalid                          |

## 12. Domain Identity

RPP's receipt model prevents unsolicited messages, but does not address the case
where two parties with a legitimate reason to communicate have no prior
relationship — for example, a researcher contacting a peer at another
university, or a business reaching out to a potential vendor.

Public invitations (Section 9.4) and domain filters (Section 9.1.4) provide the
mechanisms for first contact and access control. This section defines a
domain-level identity endpoint that helps parties assess unfamiliar domains
before accepting invitations.

Trust, reputation, and domain-to-domain administrative communication are
deliberately left outside the protocol. The `contact_policy_url` field provides
an out-of-band channel for any administrative matters (abuse reports, legal
notices, operational coordination) between domain operators.

### 12.1 Domain Self-Identification Endpoint

An RPP server MAY expose a public domain identity endpoint that provides
metadata about the domain without revealing its users.

- Path: RECOMMENDED `/.well-known/rpp-domain-identity`
- Method: GET
- Authentication: NONE (publicly accessible)

The response MUST be JSON with the following shape:

```json
{
  "domain": "cs.example-university.edu",
  "display_name": "Example University — Computer Science Department",
  "domain_type": "academic",
  "parent_domain": "example-university.edu",
  "categories_offered": ["correspondence", "event", "transactional"],
  "rpp_since": "2025-06-01T00:00:00Z",
  "contact_policy_url": "https://cs.example-university.edu/rpp-policy",
  "public_key": {
    "algorithm": "Ed25519",
    "key": "MCowBQYDK2VwAyEA..."
  }
}
```

Fields:

| Field              | Required | Description                                         |
| ------------------ | -------- | --------------------------------------------------- |
| domain             | REQUIRED | The RPP domain this identity describes              |
| display_name       | REQUIRED | Human-readable name for the domain                  |
| domain_type        | OPTIONAL | Self-declared category (see Section 12.1.1)         |
| parent_domain      | OPTIONAL | Parent organization domain, if applicable           |
| categories_offered | OPTIONAL | Message categories this domain typically sends      |
| rpp_since          | OPTIONAL | Date the domain first began operating an RPP server |
| contact_policy_url | OPTIONAL | URL for out-of-band administrative contact          |
| public_key         | OPTIONAL | Domain verification key (see Section 9.5)           |

The `contact_policy_url` is the sole mechanism for domain-to-domain
administrative communication in RPP. It SHOULD point to a page describing how to
contact the domain's operator for matters such as abuse reports, legal notices,
operational issues, or requests to unblock a domain. RPP does not define or
transmit administrative messages at the protocol layer.

#### 12.1.1 Domain Type Registry

| Type       | Description                                           |
| ---------- | ----------------------------------------------------- |
| personal   | Individual or family domain                           |
| business   | Commercial entity                                     |
| academic   | University, research institution, or educational body |
| government | Government agency or public-sector body               |
| nonprofit  | Non-governmental organization or charity              |
| healthcare | Medical provider, insurer, or health institution      |
| media      | News, journalism, or publishing organization          |

Domain types are self-declared and informational only. They MUST NOT be used for
automated authorization decisions. External services may independently verify
domain types, but that is outside the scope of this protocol.

### 12.2 Privacy Considerations

- The domain identity endpoint (Section 12.1) MUST NOT expose user lists, user
  identifiers, or message metadata.

## 13. Versioning and Compatibility

- The protocol version string is major.minor.patch.
- Breaking changes increment major.
- Backward-compatible additions increment minor.
- Editorial clarifications increment patch.

## 14. Security Considerations

- TLS is REQUIRED in production.
- Receipts are bearer-like capabilities and MUST be protected at rest and in
  transit.
- Servers SHOULD use replay mitigation (timestamp freshness and nonce cache).
- Signature verification MUST be performed over the exact raw request body
  bytes, prefixed with the timestamp and period separator (Section 5.1).
- Domain verification keys (Section 9.5.1) MUST be protected with the same rigor
  as TLS private keys. Compromise of a domain verification key allows an
  attacker to forge identity attestations for any user on that domain.
- Clients verifying invitation attestations (Section 9.5.4) MUST fetch the
  domain's public key over HTTPS and SHOULD cache it for no longer than the TTL
  indicated by standard HTTP caching headers.
- Replacement receipt secrets in renewal operations (Section 10A.4) must be
  communicated to the sender via an existing receipt or out-of-band channel.
  Servers MUST protect receipt secrets at rest with the same rigor as any other
  credential.
- Group receipt secrets are shared among all group members. Compromise of any
  member allows impersonation within that group only (TLS origin validation
  limits this — see Section 10.4). Members who suspect compromise SHOULD create
  a superseding group with a new shared secret.
- The replay protection timestamp window (Section 5.1.1) requires servers to
  maintain reasonably synchronized clocks. Servers SHOULD use NTP or a similar
  time synchronization protocol.

## 15. Deployment Architecture

RPP server implementations SHOULD deploy one server instance per domain to
ensure data isolation by design. This single-tenant-per-instance model is
recommended for the following reasons:

- **Data Isolation by Design**: Each domain's KV store, user metadata, receipts,
  and domain verification keys are isolated at the infrastructure level,
  reducing the risk of cross-domain data leakage.
- **Simplified Access Control**: No need to manually namespace persistent
  storage by domain ID; the isolation is enforced by the deployment boundary.
- **Independent Scaling and Versioning**: Each domain can scale independently
  and be updated or rolled back without affecting other domains.
- **Compliance and Auditability**: Easier to satisfy data residency
  requirements, audit trails, and regulatory compliance (e.g., GDPR, HIPAA) when
  domains are segregated.
- **Reduced Blast Radius**: A bug, security incident, or resource exhaustion in
  one instance affects only that domain.

Implementations MAY use a multi-tenant-shared deployment (one server instance
for multiple domains) if isolation is enforced through strong namespace
discipline (prefixing all persistent storage records with a domain identifier)
and strict access controls. Multi-tenant deployments MUST implement the
following safeguards:

- Domain ID MUST be included as a prefix in all primary keys or identifiers:
  `domain_id:entity_type:...` (or equivalent namespace pattern for SQL,
  document-based, or other database systems).
- Authentication and authorization code MUST verify domain membership before
  granting access to domain-specific resources.
- Quota and rate limiting MUST be enforced per domain, not globally.
- Testing MUST include multi-domain scenarios to prevent accidental cross-domain
  data access.

Single-tenant-per-instance deployments are strongly preferred due to their
inherent security properties and operational simplicity.

## 16. Open Questions

The following items are intentionally left for upcoming drafts:

- Content rating dispute resolution process.
- Display name abuse: whether servers should enforce any content policy on
  display names presented in public invitations or receipts.
- Public invitation abuse prevention: rate limiting acceptance from unknown
  domains
- Domain verification key rotation: standardized historical key endpoint format
  and maximum key age for verifying older invitation attestations.
