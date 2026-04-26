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
- Reply Invite: An optional invitation embedded in a message that offers the
  receiver a path to reply.
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

**OID privacy invariant.** User accounts are identified internally by a
server-assigned OID (opaque identifier, typically from an OIDC token). OIDs are
strictly server-internal with respect to cross-domain communication: they MUST
NOT appear in any data transmitted to another domain — including submitted
message envelopes, invitation envelopes, receptive policy tokens, or any HTTP
request or response body sent over the wire between RPP servers. OIDs MAY appear
in same-domain MCP tool responses visible only to the account owner or domain
administrator. The only cross-domain identity artifacts defined by this protocol
are `domain` (a DNS hostname) and `domain_id` (a UUID scoped to that domain).

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

When a receiver issues a receipt (via invitation acceptance or reply invite),
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

### 4.1 Transport Security

All RPP traffic between servers MUST be carried over HTTPS (TLS). Servers MUST
NOT accept or deliver messages over plain HTTP in production.

**Exception:** `localhost` deployments (where the domain is `localhost` or
`localhost:port`) MAY use plain HTTP. This exception exists solely to support
local development and testing.

### 4.2 Required Endpoints

An RPP server MUST expose two HTTP endpoints:

1. RPP Envelope Endpoint (backend-to-backend):
   - Method: POST
   - Path: implementation-defined (RECOMMENDED: `/rpp/v1/envelopes`)
   - Purpose: Accept one envelope per request. Envelopes carry `message`,
     `invitation`, or `receipt` payloads (Section 7).

2. MCP Endpoint (listener interface):
   - Transport: MCP over HTTP
   - Path: implementation-defined (RECOMMENDED: `/mcp`)
   - Purpose: Authenticated send/receive and workflow orchestration for local
     listeners connected to their own server domain.

Cross-domain peers identify each other by **domain** (DNS hostname). Peers
SHOULD fetch the domain identity endpoint (Section 12.1) to discover the exact
endpoint URLs before first contact. Servers that do not publish a domain
identity document are assumed to expose the conventional paths above.

### 4.3 Agent and Cross-Server Communication

- Agents connect to the MCP endpoint of their own RPP server domain.
- Tools executed via MCP MAY call HTTP submit endpoints on other RPP servers.

### 4.4 Message Cardinality

- Each delivered message MUST have exactly one sender and exactly one receiver.
- Fanout MUST be expressed as multiple independent message submissions.

## 5. Authentication and Authorization

### 5.1 Envelope Endpoint Authentication

RPP envelope-endpoint authentication is HMAC-based and request-bound. The
authentication scheme is uniform across all envelope kinds (Section 7); only the
**identity header** and the **HMAC key source** vary by kind.

Each POST request MUST include exactly one identity header — selected by
envelope kind — together with the signature and timestamp headers:

| Identity header       | Used by envelope kind(s)                              | HMAC key                                 |
| --------------------- | ----------------------------------------------------- | ---------------------------------------- |
| `x-rpp-receipt-id`    | `message`; `invitation` (receipt-based re-invitation) | `receipt_secret` of the named receipt    |
| `x-rpp-invitation-id` | `receipt` (invitation-acceptance callback)            | `delivery_token` of the named invitation |

Invitation envelopes against an open receptive policy (i.e., first contact where
no prior receipt exists) are a third case: the `receptive_policy_id` embedded in
the envelope itself acts as the bearer credential authorizing delivery into that
policy window. Such envelopes MAY be submitted without an identity header. A
future revision MAY tighten this to require HMAC over a policy-scoped key; for
v0.2-draft, policy-based invitations rely on the secrecy of the
`receptive_policy_id` (which is shared out-of-band by the receiver, e.g., via QR
code).

In addition, every HMAC-signed request MUST include:

- `x-rpp-signature`: lowercase-hex HMAC-SHA-256 of the canonical input below,
  using the key resolved from the identity header.
- `x-rpp-timestamp`: ISO 8601 UTC timestamp of when the request was created (see
  Section 5.1.1).

Canonical HMAC input:

```
HMAC_SHA256(key=<resolved-key>, data=x-rpp-timestamp + "." + request_body_bytes)
```

The HMAC input MUST be the concatenation of the `x-rpp-timestamp` header value,
a literal ASCII period (`.`), and the raw request body bytes. This binds the
timestamp to the signature and prevents an attacker from replaying a captured
request with a fresh timestamp.

The receiving server resolves the key by:

1. Reading whichever identity header is present.
2. Looking up the corresponding record (receipt or invitation) and extracting
   its associated key (`receipt_secret` or `delivery_token`).
3. Computing the HMAC over the canonical input.
4. Comparing constant-time against `x-rpp-signature`.

For HMAC-signed requests, exactly one identity header MUST be present. Multiple
identity headers, or an identity header that does not match the envelope
`category`, MUST be rejected with `E_INVALID_AUTH_HEADERS`.

Servers MUST reject requests with missing, unknown, malformed, expired,
consumed, or policy-violating credentials. The canonical list of RPP error codes
is defined in the **RPP Error Code Registry** in Section 11.2.

Notes on HTTP status usage on the envelope endpoint:

- HTTP 400 is used for syntactic and structural request errors that are
  independent of credential validity.
- HTTP 403 is used for all credential authorization failures (unknown receipt,
  revoked policy, consumed delivery token, signature mismatch). Servers MUST NOT
  use 401 for the envelope endpoint because authentication is credential-based,
  not session-based.
- HTTP 413 is used when the request body exceeds the protocol maximum size
  (Section 7.1.1).
- The RPP error code MUST be returned in the response body per the error model
  defined in Section 11 and MUST match the code registered in Section 11.2.

#### 5.1.1 Replay Protection

RPP uses a combination of timestamp freshness and envelope-ID deduplication to
prevent replay attacks.

**Timestamp freshness.** Every envelope request MUST include an
`x-rpp-timestamp` header containing an ISO 8601 UTC timestamp (e.g.,
`2026-04-04T12:00:00Z`). The receiving server MUST reject any request whose
timestamp differs from the server's current UTC time by more than **60 seconds**
with `E_REQUEST_STALE` (see Section 11.2).

**Envelope deduplication.** The receiving server MUST maintain a deduplication
cache keyed by envelope identity:

- `message` envelopes: deduplicated by `(sender_domain, message_id)`.
- `invitation` envelopes: deduplicated by `(sender_domain, invitation_id)`.
- `receipt` envelopes: deduplicated by `invitation_id` (only one terminal
  callback per invitation is ever valid; see Section 9.7).

If a request arrives whose dedup key the server has already accepted within the
deduplication window, the server MUST reject it with `E_DUPLICATE_MESSAGE`
(submit-equivalent) for messages and invitations, or `E_INVITATION_NOT_PENDING`
for a duplicate receipt callback. The deduplication cache MUST retain entries
for at least **60 seconds** — matching the timestamp freshness window. Servers
MAY retain entries longer.

These two mechanisms work together: the 60-second timestamp window limits how
long a captured request remains valid, and the dedup cache ensures that even
within that window, the same envelope cannot be accepted twice.

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

The MCP endpoint returns errors drawn from the unified **RPP Error Code
Registry** in Section 11.2. The `mcp-auth` category covers authentication, token
validation, origin validation, and scope enforcement failures; the `mcp-tool`
category covers errors raised during tool execution. The general HTTP status
conventions for the MCP endpoint are:

| HTTP Status | Condition                                      |
| ----------- | ---------------------------------------------- |
| 401         | No token, invalid token, or expired token      |
| 403         | Valid token but insufficient scope/permissions |
| 400         | Malformed authorization request or bad session |

See Section 11.2 for the specific error codes returned in each case.

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

The receiver account OID is NOT a wire-protocol receipt property. It is a
server-internal routing field used to associate a receipt with the account that
issued it. Implementations MUST NOT include the OID in any data transmitted to
another domain (submitted envelopes, wire responses between RPP servers, etc.).
It MAY appear in same-domain MCP tool responses visible to the account owner or
administrator (see Section 3A.1, OID privacy invariant).

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

### 6.6 Receipt Superseding

A receipt identifies a specific trust relationship between a sender identity and
a receiver account. When a new receipt is issued to a sender who already has one
or more active receipts with the same receiver account, the older receipts are
superseded by the new one.

**Sender identity** is the composite pair `(sender_domain, sender_domain_id)` —
the invitation's `sender_domain` combined with the `domain_id` value from
`claims.immutable`. Because `domain_id` is scoped to its issuing domain (Section
9.1.5), identity is stable only within a domain. A sender who migrates to a new
hostname will have a different composite identity and will not supersede
receipts based on the old hostname.

**Superseding rule:** When a new receipt is issued as a result of accepting an
invitation, the server MUST revoke all existing active receipts on that receiver
account whose `(sender_domain, sender_domain_id)` matches the new receipt's
composite sender identity. Superseded receipts MUST record `revoked_at` and
revocation reason `SUPERSEDED`.

Receipts lacking either `sender_domain` or `sender_domain_id` are not subject to
superseding and remain active.

**Rationale:** Multiple active receipts from the same identity create ambiguity
about which secret to use and accumulate stale keys. Superseding guarantees at
most one active receipt per
`(receiver_account, sender_domain, sender_domain_id)` triple.

## 7. Envelope Model

The envelope endpoint (Section 4.2) accepts a single JSON envelope per POST.
Every envelope has a top-level `category` field that selects one of three
**envelope kinds**:

| `category`   | Kind       | Purpose                                                 | Section |
| ------------ | ---------- | ------------------------------------------------------- | ------- |
| `invitation` | invitation | Offer a future receipt grant                            | §9      |
| `receipt`    | receipt    | Deliver an invitation acceptance/rejection to a sender  | §9.7    |
| any other    | message    | Normal message body (e.g., `correspondence`, `billing`) | §7.1    |

The category registry in Section 7.2 enumerates all message-kind values. The
`invitation` and `receipt` categories are reserved protocol kinds and are NOT
message bodies in the user-facing sense; they carry protocol control payloads.

### 7.1 Message Envelope

A `message`-kind envelope carries a normal user-facing message body. The POST
body MUST be JSON with this base shape:

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
  "reply_invite": null,
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
- reply_invite MAY be omitted or null.

### 7.1.1 Maximum Message Size

The maximum size of the HTTP request body for the submit endpoint is **256 KB**
(262,144 bytes). Servers MUST reject requests whose `Content-Length` exceeds
this limit with HTTP 413 and RPP error code `E_MESSAGE_TOO_LARGE` (see Section
11.2).

This limit applies to the entire JSON envelope including all body content. RPP
is not designed for large binary payloads — senders SHOULD include URLs
referencing external resources rather than embedding large content inline.

Servers MUST NOT accept request bodies larger than 256 KB, even if the
underlying HTTP server would otherwise permit it. This limit is protocol-
mandatory and not configurable.

### 7.1.2 Message Body Content Type

The `body` object in the message envelope MUST contain a `content_type` field
and a `content` field. RPP defines two permitted content types:

- **`text/markdown`** — for human-readable message bodies.
- **`application/json`** — for structured, machine-readable payloads (e.g.,
  agent-to-agent coordination, structured notifications, transactional data).

The `content_type` field MUST be exactly one of these two values. Servers MUST
reject any message with any other `content_type` with `E_INVALID_CONTENT_TYPE`.

#### Markdown bodies (`text/markdown`)

When `content_type` is `text/markdown`, the `content` field MUST be a UTF-8
Markdown string conforming to CommonMark.

Senders SHOULD use CommonMark syntax for structure (headings, lists, links,
emphasis, code blocks). Senders MUST NOT embed raw HTML in Markdown content —
receiving clients SHOULD strip any HTML tags encountered during rendering.

This gives RPP a single, portable, plaintext-safe format that every client can
render consistently. Unlike email, there is no negotiation between HTML, plain
text, and multipart alternatives. Markdown is readable as plain text and
renderable as rich text — one format serves both needs.

#### JSON bodies (`application/json`)

When `content_type` is `application/json`, the `content` field MUST be a UTF-8
string containing a syntactically valid JSON document (RFC 8259). The top-level
JSON value MUST be an object or an array; bare scalars (string, number, boolean,
null) MUST NOT be used as the top-level value.

Servers MUST validate JSON syntax before accepting the message and MUST reject
malformed JSON with `E_INVALID_BODY` (HTTP 400). Servers MUST NOT attempt to
interpret, transform, or schema-validate the JSON payload beyond syntactic
well-formedness — application-level schema is the responsibility of sender and
receiver.

Receiving clients MUST NOT render JSON content as if it were Markdown. Receivers
SHOULD treat JSON bodies as opaque structured data intended for programmatic
consumption.

The 256 KB envelope limit (Section 7.1.1) applies regardless of `content_type`.

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

Successful acceptance of an envelope MUST return HTTP 202 or HTTP 200. The
response body shape varies by envelope kind:

**Message envelope** — the response confirms acceptance:

```json
{
  "ok": true,
  "accepted": true,
  "message_id": "019644a1-7e2a-7b3c-8d1e-1f2a3b4c5d6e"
}
```

**Invitation envelope** — the response confirms acceptance for delivery and
echoes the invitation_id. If the receiver's receptive policy auto-accepts at
submit time (rather than holding the invitation as `pending`), the response MAY
additionally include the issued receipt inline as an optimization:

```json
{
  "ok": true,
  "accepted": true,
  "invitation_id": "019644a1-7e2a-7b3c-8d1e-1f2a3b4c5d6e",
  "receipt": {
    "id": "...",
    "secret": "...",
    "category": "billing",
    "max_content_rating": "PG",
    "usage_policy": "any-time",
    "issued_at": "2026-04-25T12:00:00Z"
  }
}
```

When the inline receipt is present, the sender MAY skip waiting for the receipt
callback (Section 9.7); when it is absent, the sender MUST wait for the
canonical callback delivery. The inline form is a strict optimization and is
optional for receivers; senders MUST handle both forms.

**Receipt envelope** — see Section 9.7. The response confirms the callback was
processed and consumed the delivery token.

## 8. Reply Invites

A sender MAY include a `reply_invite` in a message. A reply invite is a standard
invitation payload (Section 9) embedded in the message body that offers the
receiver a path to reply — even if no prior receipt existed in the reverse
direction.

Unlike a reply receipt, a reply invite does **not** embed a bearer credential.
The receiver uses it as input to the normal invitation flow: the receiver sends
a `category: "invitation"` message back to the sender's submit endpoint citing
the `receptive_policy_id` (or `receiver_domain`) supplied in the invite. The
sender's server processes it exactly like any other incoming invitation. If the
sender accepts, a receipt is issued to the receiver in the normal way (Section
6). The receiver then holds that receipt and may send messages back to the
sender using it.

The key properties of this design:

- No secret credential travels in a message body or is stored in the receiver's
  message store.
- The sender retains full control: they may accept, decline, or let a receptive
  policy decide automatically.
- Invitation acceptance does **not** notify the original sender. The receiver
  either sends an invitation back or does not; silence is always valid.
- The full invitation → receipt → message path is the same protocol primitive
  already used everywhere else in RPP.

### 8.1 Reply Invite Properties

A `reply_invite` MUST include:

- `receptive_policy_id` — the UUID of an active receptive policy on the sender's
  server that the receiver may target when sending their reply invitation.
- `receiver_domain` — the sender's domain, so the receiver's server knows where
  to POST the invitation.

A `reply_invite` MAY include:

- `proposed_terms` — a suggested `ReceiptTerms` object (Section 6.1) that the
  sender is willing to issue. The sender is not bound by these terms; they are
  informational guidance to the receiver.
- `expires_at` — an ISO 8601 timestamp after which the policy window is no
  longer guaranteed to be open.

The receiver is never obligated to use, store, or honor a reply invite. The
receiver MAY ignore it entirely.

### 8.2 Reply Invite Processing

When a receiver's server encounters a `reply_invite` in an inbound message, it
MAY store the invite alongside the message so the listener can act on it later.
The receiver's server MUST NOT automatically send an invitation back without
explicit listener authorization.

When a listener decides to reply, their server sends a `category: "invitation"`
envelope to the original sender's domain (one cross-domain POST), citing the
`receptive_policy_id` from the invite. The original sender's server processes
this exactly like any direct invitation (Section 9). Acceptance follows the
canonical asynchronous flow:

1. The original sender's listener accepts (or rejects) the invitation at any
   later point — this MAY be immediate or delayed by days, months, or longer.
2. The original sender's server delivers the resulting receipt back to the
   replying party's domain via a `category: "receipt"` callback (Section 9.7).
3. The replying party's server stores the receipt and the listener may then send
   reply messages using it per the normal envelope flow.

**Auto-accept optimization.** Because the originating sender embedded the
`reply_invite` precisely to signal willingness to receive replies, the targeted
receptive policy SHOULD be configured to auto-accept. When auto-acceptance
applies, the original sender's server MAY return the receipt inline in the HTTP
202 response to the invitation POST (see §7.4) and skip the §9.7 callback. This
is an optimization; the canonical asynchronous path remains fully supported and
is what the replying party MUST be prepared to handle by default.

### 8.3 Reply Invite Chaining

A message delivered using a receipt obtained via a reply invite MAY itself
include a new `reply_invite`. This allows multi-turn conversations to develop
naturally without either party needing to discover the other's receptive policy
out-of-band. Each reply invite is independent — it references a fresh policy and
does not inherit terms from any prior receipt or invite.

Servers SHOULD NOT impose a protocol-level limit on reply chain depth.

### 8.4 Reply Invite Expiry

A `reply_invite` is valid as long as the referenced `receptive_policy_id` is
active on the sender's server. If the policy has been deactivated or expired by
the time the receiver sends their invitation, the sender's server MUST reject
the invitation with the standard policy-not-found error (Section 11). The
`expires_at` hint in the invite is informational only; receivers SHOULD NOT rely
on it as an authoritative expiry.

## 9. Invitations

Invitations are category=invitation messages that offer receipt grants.

There are two primary forms of invitation:

1. **Direct invitations** sent when one party has obtained another's
   `receptive_policy_id` and `receiver_domain` out-of-band (e.g., via QR code or
   NFC). The sender provides these to the server, which resolves the receiver
   and creates the invitation record. Once a prior invitation has been accepted
   and a receipt issued, the sender MAY instead use the existing `receipt_id` to
   re-invite the same receiver without a new receptive window — this is a
   subtype of direct invitation called **receipt-based re-invitation** (Section
   9.1.6).
2. **Public invitations** created by a user and discoverable by invitation ID
   (Section 9.4). Public invitations are the primary mechanism for first contact
   between strangers.

Because RPP has no user-level addresses (Section 3A), invitations are not "sent
to an address." For direct invitations the `receptive_policy_id` acts as a
capability token that both identifies the intended receiver (without exposing
their internal identifier) and proves they have opted in to receiving
invitations. For receipt-based re-invitations the receiver is identified
implicitly via the `receipt_id`, which is already known to the sender from the
prior exchange.

The core protocol flow is:

```
Receptive Policy → Invitation → Receipt → Message
```

A receiver MUST first establish a receptive policy before any invitation can be
delivered to them. Receipts are issued when an invitation is accepted, and
receipts enable future message delivery.

### 9.1 Receptive Policy

Receivers MUST explicitly opt in to invitations. A receiver does this by
creating one or more **receptive policies**. Each policy is an independent
record with a unique `policy_id` (UUID). Policies stack — a receiver MAY have
multiple active policies simultaneously (e.g., a standing `.edu` domain-filter
policy plus a short-lived proximity window).

When an invitation arrives, the server looks up the policy by the
`receptive_policy_id` supplied in the invitation. If no matching, active policy
is found, delivery MUST be rejected.

Each policy specifies a `mode`:

- receptive to all invitations (`all`),
- receptive by domain filter only (`domain_filter`, Section 9.1.4),
- receptive by contact list only (`contact`),
- explicitly closed to all senders (`closed`).

The `closed` mode allows a receiver to publish an explicit "not accepting"
signal without removing all policies. A policy with `mode: "closed"` will always
cause delivery to be rejected with `E_RECEPTIVE_POLICY_CLOSED`, regardless of
other policies, when that specific policy is referenced.

> **No `status: "deactivated"` field.** Receptive policies have no deactivated
> state. Receipt-mode policies are **deleted** when their backing receipt is
> revoked (Section 9.1.6). For user-created policies, the account owner removes
> them explicitly via `remove_receptive_policy`. Deactivation as a concept is
> intentionally absent to keep the policy data model simple.

If a receiver has no policies, the default state is closed — the server MUST NOT
allow invitations unless the listener has explicitly created a receptive policy.

#### 9.1.1 Time-Bounded Receptivity

A receiver MAY open a time-bounded receptive window by calling
`open_receptive_window`. This creates a new receptive policy record with a
`receptive_until` timestamp and a `policy_id` that can be shared out-of-band.
This is analogous to a Bluetooth pairing window: the receiver signals readiness
for a short period by sharing their `policy_id` (e.g., as a QR code).

A timed policy MUST include:

- `policy_id`: a UUID identifying this policy,
- `receptive_until`: an ISO 8601 timestamp after which the policy expires,
- `mode`: the scope filter (`all` or `domain_filter`) that applies during the
  window.

Opening a new window DOES NOT replace existing windows or base policies —
windows stack. If the receiver wants to revoke a window early, they must
explicitly remove the policy.

Servers MUST reject invitations targeting a `receptive_policy_id` whose
`receptive_until` has passed with `E_RECEPTIVE_POLICY_EXPIRED` (see Section
11.2, category `receptive-policy`).

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

#### 9.1.5 Contact-Based Receptivity

A receiver MAY create a receptive policy with `mode: "contact"` to accept
invitations from specific known senders, identified by their
`(sender_domain, domain_id)` composite pair.

**Domain scoping of `domain_id`.** A `domain_id` is a UUID assigned by and
scoped to a single issuing domain. It is NOT a globally unique identifier. Two
different domains MAY independently assign the same UUID to different users;
these are NOT considered collisions because `domain_id` is only meaningful
within the context of its issuing domain. Servers MUST always treat
`(domain, domain_id)` as the composite sender-identity key and MUST index
contacts and contact-mode policies on this composite key. Servers MUST NOT match
or deduplicate senders by `domain_id` alone.

A contact-mode policy MUST include `contacts`: an array of objects, each
carrying both the issuing `domain` (hostname) and the `domain_id` UUID:

```json
{
  "mode": "contact",
  "contacts": [
    {
      "domain": "alice.example",
      "domain_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
    }
  ]
}
```

When an invitation arrives referencing this policy, the server MUST:

1. Read `sender_domain` from the invitation envelope.
2. Read `domain_id` from `claims.immutable.domain_id`.
3. Verify the composite pair `(sender_domain, domain_id)` appears in `contacts`.
   Matching MUST be exact on `domain_id` and case-insensitive on `domain`.
4. If either value is missing or the pair is not listed, reject with
   `E_RECEPTIVE_POLICY_CLOSED` (see Section 11.2, category `receptive-policy`).

**Hostname migration.** Because `domain_id` is scoped to its issuing domain, a
sender that migrates to a different hostname is — from the receiver's
perspective — a different identity under contact-mode policies. If a contact's
hostname changes, the receiver MUST update the stored `(domain, domain_id)` pair
explicitly; contact-mode policies do NOT transparently follow hostname changes.

Contact-based receptivity is useful for maintaining a standing, open-ended
receptive relationship with known contacts without requiring time-bounded
windows or hostname-based glob filters. Compared to domain filters (Section
9.1.4), contact-mode policies admit only the specific identities you have
previously transacted with, not every user under a matched hostname.

**Immutability.** Once a contact-mode policy is created, its `contacts` list is
fixed and cannot be modified in-place. To add or remove a `(domain, domain_id)`
entry, the caller MUST delete the existing policy and create a replacement with
the revised `contacts` list. The new policy is assigned a new `policy_id`, which
the caller is responsible for distributing to any senders who held the previous
one. This trade-off keeps the policy data model simple and avoids partial-update
race conditions.

#### 9.1.6 Receipt-Based Receptivity

Once a receiver accepts an invitation and issues a receipt, they SHOULD
automatically become receptive to future re-invitations from the same sender
backed by that receipt. This enables the sender to refresh terms, provide
updated claims, or replace an expired receipt without requiring the receiver to
proactively open a new receptive window.

**Auto-creation.** When a receipt is issued (invitation accepted), the server
SHOULD automatically create a `mode: "receipt"` receptive policy keyed to that
`receipt_id`. This policy has no time limit; it remains active as long as the
underlying receipt is active. Because every accepted invitation generates one of
these policies, a prolific user may accumulate many of them. The
`get_receptive_policies` tool therefore omits `mode: "receipt"` policies from
its default output; callers MUST pass `include_receipt_policies: true` to
include them.

**Invitation delivery.** A sender MAY include `receipt_id` in the invitation
envelope instead of `receptive_policy_id`. When the submit endpoint receives an
invitation with a `receipt_id`:

1. The server MUST look up the receipt by `receipt_id`.
2. If the receipt does not exist or is not active, reject with
   `E_RECEIPT_NOT_ACTIVE` (see Section 11.2).
3. The server MUST resolve the receiver account via the receipt's internal
   server-side account association (stored when the receipt was created). This
   association MUST NOT be transmitted to any external party (see Section 3A.1).
4. The server MUST verify that a `mode: "receipt"` policy for this `receipt_id`
   exists on the receiver's account. If not, reject with
   `E_RECEPTIVE_POLICY_NOT_FOUND` (see Section 11.2).
5. The invitation is created as `pending` on the receiver's account.

**Automatic deletion.** When a receipt is revoked (for any reason including
superseding), the server MUST delete all `mode: "receipt"` policies associated
with that `receipt_id`.

**Superseding interaction.** When a receipt is superseded by a new one (Section
6.6), the following cascade occurs atomically:

1. The old receipt is revoked with reason `SUPERSEDED`.
2. The `mode: "receipt"` policy keyed to the **old** `receipt_id` is deleted.
3. A new receipt is issued with a fresh `receipt_id`.
4. A new `mode: "receipt"` policy keyed to the **new** `receipt_id` is created.

The sender's previously held `receipt_id` is now stale. Any re-invitation
attempt that presents the old `receipt_id` will be rejected at step 1 of
invitation delivery (above) with `E_RECEIPT_NOT_ACTIVE`. The sender obtains the
new `receipt_id` only when the receiver's domain delivers it as part of the new
accepted-invitation response; until that exchange occurs, the sender SHOULD fall
back to other receptive mechanisms (e.g., a contact-mode or domain-filter
policy) or wait for the receiver to initiate contact.

**Rationale.** Receipt-based re-invitation allows the sender to refresh the
relationship (update claims, negotiate new terms, cycle the receipt secret)
without requiring out-of-band coordination. The receiver retains full control —
they must explicitly accept each new invitation.

### 9.2 Invitation Lifecycle

An invitation MUST include:

- `invitation_id`,
- offered receipt terms,
- `delivery` — the receipt-callback delivery descriptor (see Section 9.7).

An invitation MAY include:

- `expires_at`: an ISO 8601 UTC timestamp after which the invitation is no
  longer valid. If omitted, the invitation does not expire and remains in the
  `pending` state until the receiver acts on it or the sender cancels it.
  Senders SHOULD include an `expires_at` for time-bounded exchanges (e.g.,
  proximity pairing) but MAY omit it for standing offers.

The `delivery` block is REQUIRED on every direct invitation envelope (Section
9.6 shows the full envelope). It carries the sender's domain and a single-use
HMAC key (`delivery_token`) that the receiver's server uses to authenticate the
eventual `category: "receipt"` callback that delivers the acceptance or
rejection. Public invitations (Section 9.4) generate a `delivery` block per
accepting party at the time of acceptance; see Section 9.7.

Invitation state transitions:

- `pending` -> `accepted` (receiver listener accepted; receipt issued and
  delivered to sender via §9.7)
- `pending` -> `rejected` (receiver listener rejected; rejection delivered to
  sender via §9.7)
- `pending`/`accepted` -> `cancelled` (sender action)
- `pending` -> `expired` (no acceptance before `expires_at`)

The `accepted` and `rejected` transitions on the receiver's side are NOT
complete until the corresponding receipt envelope has been successfully
delivered to the sender (or, in the auto-accept inline-receipt optimization,
returned in the §7.4 response). Until delivery succeeds, the receiver's server
MUST treat the invitation as in a transitional state and retry per Section 9.7.

When an invitation is cancelled, all receipts derived from that invitation MUST
be invalidated.

**Receipt revocation does not affect pending invitations.** The `receipt_id`
used for receipt-based delivery (Section 9.1.6) is a routing token consumed at
submission time to resolve the receiver and create the `pending` record. Once
the invitation is stored as `pending`, it is fully independent of the backing
receipt's lifecycle. If that receipt is subsequently revoked — by either party,
for any reason including superseding — already-pending invitations derived from
that receipt are unaffected and remain in `pending` state. The receiver MAY
still accept, reject, or let them expire normally; the sender MAY still cancel
them. Revoking a receipt cascades only to receipts issued _from_ prior accepted
invitations (Section 6.6), not to still-pending invitations that were _delivered
via_ that receipt.

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
   `E_RECEPTIVE_POLICY_CLOSED` (see Section 11.2, category `receptive-policy`).
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

### 9.6 Sender Claims on Direct Invitations

A sender MAY attach optional **claims** to a direct invitation envelope to
provide the receiver with contextual information about the sender. Claims are
informational only — they do not alter the protocol flow and do not affect
receptive policy evaluation.

Claims are expressed as a `claims` object nested inside the `invitation` field
of the envelope:

```json
{
  "category": "invitation",
  "invitation": {
    "receptive_policy_id": "...",
    "proposed_terms": { "categories": ["billing"] },
    "claims": {
      "immutable": { "domain_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6" },
      "user": { "name": "Alice Smith", "email": "alice@sender.example" },
      "admin": { "institution": "Example University" },
      "custom": { "note": "We met at the conference" }
    }
  }
}
```

Four claim namespaces are defined:

| Namespace   | Trust level               | Source                                                                                                                                                                                                       |
| ----------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `immutable` | Highest — domain-assigned | Server-assigned values (e.g. `domain_id`) injected automatically from the sender's `immutable_fields`. The caller MUST NOT supply this namespace. The server MUST always include it.                         |
| `user`      | Server-attested           | Values from the sender's authenticated identity token, stored as `user_verified_fields` and resolved by the sending server. The caller MUST NOT supply values — only the server may populate this namespace. |
| `admin`     | Admin-attested            | Values set by the sending domain's administrator, stored as `admin_verified_fields` and resolved by the sending server. The caller MUST NOT supply values directly.                                          |
| `custom`    | Unverified                | Caller-supplied free-form data. The receiver MUST treat these as self-declared with no independent verification.                                                                                             |

The `immutable` namespace MUST be present on every direct invitation envelope.
The server MUST populate it from the sender's `immutable_fields` record (Section
10B.8). The `user`, `admin`, and `custom` namespaces are optional; only those
with at least one entry are included.

#### 9.6.1 Claim Value Constraints

To keep the total envelope size bounded and values reliably serializable, all
values within the `claims` object MUST conform to the following unified
constraints. These constraints apply equally to all four namespaces:

| Constraint             | Limit                                                             |
| ---------------------- | ----------------------------------------------------------------- |
| Allowed value types    | `string`, `number`, `boolean`, `null`, or a flat array of those   |
| String max length      | 512 characters per string value (including strings inside arrays) |
| Array max items        | 20 items per array value                                          |
| Nested objects         | NOT allowed — only scalars and flat arrays of scalars             |
| Max keys per namespace | 20 keys                                                           |
| Key max length         | 64 characters per key name                                        |

Servers MUST validate these constraints on inbound envelopes and MUST reject any
`send_invitation` call whose `custom` claims violates them with
`E_INVALID_MESSAGE_ENVELOPE` (HTTP 400; see Section 11.2). Servers MUST also
enforce these constraints on server-resolved values before writing them into the
envelope.

#### 9.6.2 Receiver Obligations

- The receiver MUST NOT treat `custom` claim values as verified or
  authoritative.
- The receiver SHOULD surface the trust level of each namespace to the user
  (e.g., "verified by sender's server" vs. "self-declared").
- The receiver MAY use claim values to inform their accept/reject decision but
  MUST NOT make automated protocol decisions based on claim content.
- The receiver MAY ignore claims entirely.

#### 9.6.3 Relationship to Domain-Verified Invitations (Section 9.5)

The `claims` mechanism is a complementary, lighter-weight companion to the
cryptographic `verification` attestation defined for public invitations (Section
9.5).

| Aspect          | `claims` (Section 9.6)                | `verification` (Section 9.5)                          |
| --------------- | ------------------------------------- | ----------------------------------------------------- |
| Applies to      | Direct invitations                    | Public invitations                                    |
| Authenticity    | Server-resolved but unsigned          | Ed25519 signature by hosting domain                   |
| Receiver action | Informational; no verification step   | Receiver verifies signature against domain public key |
| Scope           | Any metadata key stored in the record | Fields the domain is willing to attest                |

Senders who create public invitations SHOULD use the `verification` mechanism
(Section 9.5) rather than `claims`, as it provides cryptographic authenticity.
`claims` is intended primarily for direct, one-to-one invitations where the
cryptographic overhead of Section 9.5 is unnecessary.

### 9.7 Acceptance Callback (Receipt Envelope)

Invitations may sit in `pending` state for an arbitrary duration — minutes,
days, or years — before a listener acts on them. To deliver the resulting
receipt (or rejection) back to the sender across that asynchronous gap, RPP
defines a dedicated **receipt envelope** that the receiver's server POSTs to the
sender's envelope endpoint. The receipt envelope is the canonical mechanism for
completing invitation lifecycle.

#### 9.7.1 Delivery Block on Invitations

Every direct invitation envelope (Section 9.6) MUST include a `delivery` object
that describes how to reach the originating sender's envelope endpoint and
supplies the credential that authenticates the future callback:

```json
"delivery": {
  "domain": "sender.example",
  "token": "<128-bit hex string, generated by sender>",
  "expires_at": "2027-04-25T12:00:00Z"
}
```

| Field        | Required | Description                                                                                                                                                |
| ------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `domain`     | REQUIRED | The sender's RPP domain. The receiver's server constructs the callback URL by combining this with the conventional envelope path (Section 4.2).            |
| `token`      | REQUIRED | A high-entropy (≥128 bits) sender-generated value used as the HMAC key for the receipt envelope (Section 5.1). Single-use, scoped to this `invitation_id`. |
| `expires_at` | OPTIONAL | ISO 8601 timestamp after which the sender will no longer accept the callback. If omitted, the token is valid for the lifetime of the invitation.           |

The sender:

- MUST generate a fresh `token` per invitation. Tokens MUST NOT be reused across
  invitations.
- MUST persist the `(invitation_id, token)` pair so that the eventual callback
  can be authenticated.
- MUST treat the token as consumed on first successful (`accepted` or
  `rejected`) callback delivery; subsequent callbacks for the same
  `invitation_id` MUST be rejected with `E_DELIVERY_TOKEN_CONSUMED`.

For public invitations (Section 9.4), the `delivery` block is generated by the
hosting domain at the moment of acceptance: when an acceptor's server fetches
the invitation and indicates intent to accept, the hosting domain returns a
freshly issued `delivery` block scoped to that acceptance. The exact mechanism
is implementation-defined.

#### 9.7.2 Receipt Envelope

When a receiver's listener accepts or rejects an invitation, the receiver's
server constructs a `category: "receipt"` envelope and POSTs it to
`https://{delivery.domain}/rpp/v1/envelopes` (or whatever path the sender
publishes per Section 4.2 / 12.1).

Acceptance shape:

```json
{
  "category": "receipt",
  "invitation_id": "019644a1-7e2a-7b3c-8d1e-1f2a3b4c5d6e",
  "decision": "accepted",
  "reason": "Looking forward to working with you!",
  "receipt": {
    "id": "...",
    "secret": "...",
    "category": "billing",
    "max_content_rating": "PG",
    "usage_policy": "any-time",
    "issued_at": "2026-04-25T12:00:00Z",
    "display_name": "Alice"
  }
}
```

Rejection shape:

```json
{
  "category": "receipt",
  "invitation_id": "019644a1-7e2a-7b3c-8d1e-1f2a3b4c5d6e",
  "decision": "rejected",
  "reason": "Not accepting new correspondents at this time."
}
```

Fields:

| Field           | Required when                     | Description                                                                              |
| --------------- | --------------------------------- | ---------------------------------------------------------------------------------------- |
| `category`      | always                            | MUST be the literal string `"receipt"`.                                                  |
| `invitation_id` | always                            | The `invitation_id` of the original invitation. Acts as the dedup key (Section 5.1.1).   |
| `decision`      | always                            | One of `"accepted"` or `"rejected"`.                                                     |
| `receipt`       | REQUIRED if `decision = accepted` | The newly issued receipt: id, secret, terms, and optional voluntary display name.        |
| `reason`        | OPTIONAL (either decision)        | Free-form short string for human consumption only. MUST NOT be used for routing or auth. |

Authentication: the receiver's server signs the receipt envelope per Section
5.1, using `x-rpp-invitation-id` as the identity header and the original
invitation's `delivery.token` as the HMAC key.

#### 9.7.3 Sender Processing

On receiving a `category: "receipt"` envelope, the sender's server MUST:

1. Locate the invitation by `invitation_id`. If unknown, reject with
   `E_INVITATION_NOT_FOUND`.
2. Verify the invitation is still `pending`. If `cancelled`, `expired`, or
   already terminal (`accepted`/`rejected`), reject with
   `E_INVITATION_NOT_PENDING`.
3. Verify the `delivery.token` matches the stored token for that invitation. If
   not, reject with `E_DELIVERY_TOKEN_INVALID`. If the token is past its
   `expires_at`, reject with `E_DELIVERY_TOKEN_EXPIRED`. If the token has
   already been consumed by a prior callback, reject with
   `E_DELIVERY_TOKEN_CONSUMED`.
4. Verify the HMAC signature per Section 5.1.
5. On `decision = accepted`: store the receipt locally, mark the invitation
   `accepted`, mark the delivery token consumed.
6. On `decision = rejected`: mark the invitation `rejected`, mark the delivery
   token consumed.
7. Return HTTP 202 with
   `{ "ok": true, "accepted": true, "invitation_id": "…" }`.

#### 9.7.4 Retry Semantics

If the callback POST fails with a transient network error or 5xx response, the
receiver's server SHOULD retry with exponential backoff. The sender's server
treats retries as idempotent: because the `invitation_id` is the dedup key
(Section 5.1.1), the second successful delivery returns the same 202 response
without changing state.

If the callback fails permanently (sender's domain unreachable for a prolonged
period, or `E_INVITATION_NOT_FOUND` returned because the sender cancelled the
invitation), the receiver's server marks the invitation locally as the listener
requested (e.g., `accepted`) but flags the receipt as **undelivered**. The
receipt remains usable for sending future messages (those messages will be
authenticated by the receipt secret on the sender's side once the sender becomes
reachable), but the receiver's tooling SHOULD surface the undelivered state to
the listener.

#### 9.7.5 Auto-Accept Optimization

When a receiver's policy auto-accepts an invitation at submit time, the sender's
server is already mid-request and there is no asynchronous gap to bridge. As an
optimization, the receiver's server MAY return the issued receipt inline in the
§7.4 response and skip the §9.7.2 callback. Senders MUST handle both forms:

- If the inline `receipt` is present in the §7.4 response, the sender treats the
  invitation as `accepted` immediately.
- If absent, the sender MUST wait for the canonical callback; no acceptance has
  occurred until then.

The inline form is a strict optimization; receivers are never required to use
it.

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
  "reply_invite": null,
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

Reply invites MUST NOT be included in group messages. Multi-party reply invite
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
  revoked and subsequent submit requests using it MUST return
  `E_RECEIPT_REVOKED` (see Section 11.2).
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
`E_RECEIPT_REVOKED` (see Section 11.2).

Senders MUST treat receipt validity as uncertain and handle `E_RECEIPT_REVOKED`
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
change when their next message is rejected with `E_RECEIPT_REVOKED` (see Section
11.2). To deliver the replacement receipt to the sender, the receiver has two
options:

1. **Send via an existing receipt in the reverse direction.** If the receiver
   holds a receipt from the sender (e.g., via a reply invite or prior
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
| `cancel_invitation`        | Cancel a direct invitation the listener sent, transitioning it to       |
|                            | `cancelled`. Valid from `pending` or `accepted` state. All receipts     |
|                            | derived from the invitation are immediately revoked (Section 9.2).      |
| `send_invitation`          | Send an invitation to a receiver identified by `receiver_domain`        |
|                            | and `receptive_policy_id`. The invitation envelope is delivered to the  |
|                            | **receiver's** submit endpoint, where the receiver's server resolves    |
|                            | the policy, validates receptivity, and creates the invitation record.   |
|                            | Optionally attaches sender claims (Section 9.6): `include_user_claims`  |
|                            | and `include_admin_claims` select keys from the sending server's stored |
|                            | verified metadata; `custom_claims` passes caller-supplied unverified    |
|                            | data subject to the value constraints of Section 9.6.1.                 |
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

| Tool                      | Description                                                           |
| ------------------------- | --------------------------------------------------------------------- |
| `get_receptive_policies`  | List the listener's receptive policies (paged). Returns an empty      |
|                           | list if no policies exist (implies closed/not receptive).             |
| `add_receptive_policy`    | Add a new receptive policy. Supports modes: receptive to all,         |
|                           | by domain filter (Section 9.1.4), or by contact list. Policies stack. |
| `open_receptive_window`   | Create a time-bounded receptive policy (Section 9.1.1) with a         |
|                           | specified duration and scope. Returns the new policy's `policy_id`.   |
|                           | RECOMMENDED for proximity pairing.                                    |
| `remove_receptive_policy` | Permanently delete a receptive policy. Closes a time-bounded window   |
|                           | early or removes a standing policy. Invitations referencing the       |
|                           | deleted `policy_id` are rejected with `E_RECEPTIVE_POLICY_NOT_FOUND`. |

### 10B.6 Identity Tools

These tools manage the listener's display name and identity presentation.

| Tool                         | Description                                               |
| ---------------------------- | --------------------------------------------------------- |
| `get_display_name`           | Retrieve the listener's current default display name.     |
| `set_display_name`           | Set or clear the listener's default display name (Section |
|                              | 3A.2).                                                    |
| `set_user_verified_metadata` | Refresh the caller's `user_verified_fields` from the      |
|                              | authenticated token claims. The tool MUST replace the     |
|                              | prior user-sourced map with the current token-derived     |
|                              | values and MUST NOT modify `admin_verified_fields`.       |

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

Verified metadata has three distinct sources:

- `immutable_fields`: values assigned by the server itself at account creation
  (e.g. `domain_id`). These values are write-once and cannot be overwritten by
  any administrator or user action.
- `user_verified_fields`: values derived from the user's authenticated identity
  token.
- `admin_verified_fields`: values supplied by a domain administrator.

Merge precedence in the effective `verified_fields` view is:
`user_verified_fields` < `admin_verified_fields` < `immutable_fields`.
`immutable_fields` always wins; a user or administrator cannot shadow or
override an immutable value.

| Tool                             | Description                                                         |
| -------------------------------- | ------------------------------------------------------------------- |
| `list_verifiable_users`          | List users whose metadata the server can verify, along with the     |
|                                  | verifiable fields (e.g., display_name) and their current values.    |
|                                  | This tool MUST support resume-token pagination (Section 10B.10).    |
| `get_user_verified_metadata`     | Retrieve the verified metadata record for a specific user,          |
|                                  | including `immutable_fields`, `user_verified_fields`,               |
|                                  | `admin_verified_fields`, the effective merged `verified_fields`,    |
|                                  | and update timestamps.                                              |
| `set_admin_verified_metadata`    | Set or update admin-supplied verified metadata for a user. These    |
|                                  | values populate `admin_verified_fields` and override conflicting    |
|                                  | user-sourced values in the effective merged record used during      |
|                                  | automatic attestation (Section 9.5.3). Fields present in            |
|                                  | `immutable_fields` MUST NOT be settable via this tool — the         |
|                                  | server MUST reject such attempts with `E_IMMUTABLE_FIELD_CONFLICT`. |
| `remove_admin_verified_metadata` | Remove a specific field from a user's admin verified metadata.      |
|                                  | The server MUST automatically re-sign or strip the                  |
|                                  | `verification` object on any active invitation that                 |
|                                  | referenced the removed field. Fields present in                     |
|                                  | `immutable_fields` MUST NOT be removable via this tool — the        |
|                                  | server MUST reject such attempts with `E_IMMUTABLE_FIELD_CONFLICT`. |

### 10B.9 Domain Management — Contact Information

These tools manage the domain's out-of-band contact information published in the
domain identity endpoint (Section 12).

| Tool                     | Description                                                     |
| ------------------------ | --------------------------------------------------------------- |
| `get_contact_policy_url` | Retrieve the current `contact_policy_url` from domain identity. |
| `set_contact_policy_url` | Set or update the `contact_policy_url`. This is the sole        |
|                          | out-of-band channel for domain administrator communication.     |

### 10B.11 Contact Tools

These tools manage the per-account contact book (Section 10C).

| Tool                | Description                                                                |
| ------------------- | -------------------------------------------------------------------------- |
| `list_contacts`     | List all contacts for the authenticated account, returning flat-merged     |
|                     | current fields for each contact.                                           |
| `get_contact`       | Retrieve a single contact by ID including full field history per key.      |
| `delete_contact`    | Permanently delete a contact record (does not revoke any receipts).        |
| `set_contact_field` | Add an owner-authored custom field value to a contact. Prepends a new      |
|                     | `ContactFieldRecord` with `source: "owner_note"` to the field's history.   |
|                     | Does not replace or remove existing history entries.                       |
| `invite_contact`    | Send an invitation to a contact. Resolves the receiver domain from the     |
|                     | stored contact record; requires the caller to supply `receptive_policy_id` |
|                     | or `receipt_id` and `proposed_terms`. Fails if no contact is found.        |

### 10B.10 Pagination for List Tools

All MCP tools that return potentially unbounded lists MUST use
resume-token-based pagination. Offset-based pagination (e.g., `offset`, `page`)
MUST NOT be used.

The following conventions apply to list-style tools (including but not limited
to `list_historical_keys` and `list_verifiable_users`):

- Request parameters:
  - `page_size` (optional integer): number of entries requested.
  - `resume_token` (optional string): opaque token returned by a prior call.
- Response shape:
  - `<items_field>`: tool-specific array payload (e.g., `keys`, `users`).
  - `next_resume_token` (optional string): opaque token for the next page. If
    absent, there are no more results.

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
- Servers MAY encode implementation details in tokens, but clients MUST NOT rely
  on token structure.
- Servers SHOULD provide a stable traversal order per tool.
- Servers MUST reject malformed or expired tokens with a stable MCP error code
  (Section 11.2).

## 10C. Contact Management

RPP servers MAY maintain a contact book that maps sender identities to collected
claim metadata. Contacts are owned per-account and are automatically created or
updated when an invitation is accepted.

### 10C.1 Contact Model

A contact record represents a known sender identity on a given receiver account.

| Field        | Type                                   | Description                                                                                           |
| ------------ | -------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `id`         | UUID string                            | Server-assigned stable identifier for this contact record.                                            |
| `owner_oid`  | string                                 | OID of the receiver account that owns this contact.                                                   |
| `domain`     | string                                 | Issuing hostname of the contact, set once at creation from `sender_domain`; **immutable** thereafter. |
| `domain_id`  | UUID string                            | `domain_id` UUID scoped to `domain`. Unique per `(owner_oid, domain)`.                                |
| `fields`     | `Record<string, ContactFieldRecord[]>` | Claim fields with full history, newest-first per field key.                                           |
| `created_at` | ISO 8601                               | When the contact was first created.                                                                   |
| `updated_at` | ISO 8601                               | When the contact was last updated.                                                                    |

The combination `(owner_oid, domain, domain_id)` is the logical unique key for a
contact. Two different domains that happen to issue the same `domain_id` UUID to
different users are **not** the same contact. Servers MUST index and look up
contacts using the full composite key; matching on `domain_id` alone is invalid.

A `ContactFieldRecord` holds one historical value for a claim field:

| Field         | Type                                                                           | Description                                                                                                                                                                                                                                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value`       | string, number, boolean, null, or array                                        | The claim value as received.                                                                                                                                                                                                                                                                                                                   |
| `source`      | `"sender_verified"` \| `"domain_admin"` \| `"sender_custom"` \| `"owner_note"` | Which claim namespace the value came from. `"sender_verified"` means the sender attested the value in `claims.user`; `"domain_admin"` means the sending domain's administrator attested the value; `"sender_custom"` means the sender supplied it in `claims.custom`; `"owner_note"` means the contact owner added it via `set_contact_field`. |
| `recorded_at` | ISO 8601                                                                       | When this value was recorded.                                                                                                                                                                                                                                                                                                                  |

### 10C.2 Auto-Creation on Invitation Acceptance

When an invitation is accepted and the invitation carries a `domain_id` in its
`claims.immutable` namespace, the server MUST upsert a contact for the receiver
account. This applies to **all** accepted invitations regardless of invitation
type (direct, public, or receipt-based re-invitation):

- If no contact exists for `(owner_oid, sender_domain, domain_id)`, create one
  with `domain` set to `sender_domain`, `domain_id` set from
  `claims.immutable.domain_id`, and `created_at` set to the acceptance
  timestamp. `domain` and `domain_id` are immutable identity keys once set.
- If a contact already exists for that composite key, update `updated_at` and
  merge new fields. `domain` and `domain_id` MUST NOT be modified on update;
  they are the keys by which the contact was located.
- Merge `claims.user`, `claims.admin`, and `claims.custom` into `fields`:
  - For each key-value pair, prepend a new `ContactFieldRecord` to the history
    array for that field key. Never replace existing history entries.
  - Record the `source` (`"sender_verified"` for `claims.user`, `"domain_admin"`
    for `claims.admin`, or `"sender_custom"` for `claims.custom`) and
    `recorded_at` as the acceptance timestamp.

Similarly, the auto-creation of a `mode: "receipt"` receptive policy on
acceptance (Section 9.1.6) applies to all accepted invitations that produce a
receipt, regardless of whether the invitation was direct, public, or
receipt-based.

Receipt acceptance by the submit endpoint (i.e. message receipt) does NOT
automatically create or update contacts.

### 10C.3 Field Accumulation and Flat-Merge Presentation

Each field in `contact.fields` is an array of `ContactFieldRecord` ordered
newer-first. The server MUST preserve all historical entries.

When presenting a contact to the user (e.g. `list_contacts`, `get_contact`):

- **Flat merge**: present only the most recent value for each field as
  `current_fields`. This is a simple `Record<string, ContactFieldRecord>` keyed
  by field name.
- **Full history**: on `get_contact`, also return the raw `fields` array per key
  so callers can inspect how values have changed over time.

The contact owner MAY add custom fields at any time (source `"owner_note"`). The
server MUST record these with `recorded_at` set to the time of the call.

### 10C.4 Contact Tools

See Section 10B.11.

## 11. Error Model

All error responses MUST use content-type application/json and the following
shape:

```json
{
  "ok": false,
  "error": {
    "code": "E_RECEIPT_REVOKED",
    "message": "Receipt rcpt_abc has been revoked."
  }
}
```

- The `code` field MUST be one of the registered RPP error codes listed in the
  **RPP Error Code Registry** (Section 11.2).
- The `message` field SHOULD be a human-readable explanation and MAY vary
  between implementations.

### 11.1 MCP Endpoint Error Structures

RPP MCP endpoints use two error layers:

1. HTTP/MCP endpoint authentication and request setup failures.
2. Tool execution failures returned through MCP tool results.

#### 11.1.1 HTTP/MCP Authentication Error Envelope

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

- `code` MUST be one of the registry entries with category `mcp-auth` (Section
  11.2).
- `metadata` MAY be omitted when not needed.

#### 11.1.2 MCP Tool Error Envelope

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

- `error.code` MUST be one of the registry entries whose category describes a
  tool-raised error (e.g., `mcp-tool`, `invitation`, `receipt`, `domain-admin`,
  `receptive-policy`, `pagination`) in Section 11.2.
- `error.status` SHOULD map to an equivalent HTTP semantics for diagnostics.

#### 11.1.3 JSON-RPC/MCP Protocol Errors

Implementations MUST surface protocol-level JSON-RPC errors using standard
JSON-RPC numeric error codes.

| Code   | Meaning          |
| ------ | ---------------- |
| -32700 | Parse error      |
| -32600 | Invalid request  |
| -32601 | Method not found |
| -32602 | Invalid params   |
| -32603 | Internal error   |

### 11.2 RPP Error Code Registry

This registry is the authoritative, single source of truth for all RPP error
codes. Every code used in an RPP error response MUST appear in this registry.
Other sections of the specification reference this registry by category rather
than redefining codes locally.

The `Category` column groups codes by the subsystem that raises them:

- `submit` — errors returned by the submit endpoint (Section 5.1).
- `receptive-policy` — errors raised when evaluating or managing receptive
  policies (Section 9.1); these may be returned by the submit endpoint when
  processing invitation messages, or by receptive-policy management tools.
- `invitation` — errors raised by invitation management tools (Section 9).
- `receipt` — errors raised by receipt management tools (Section 10A).
- `domain-admin` — errors raised by domain-administration tools (Section 10B).
- `mcp-auth` — errors returned by the MCP endpoint's authentication,
  token-validation, and origin-validation layer (Section 5.2).
- `mcp-tool` — generic tool-execution errors returned through the MCP tool error
  envelope.
- `pagination` — errors raised when validating pagination parameters on
  list-style tools.

| RPP Error Code                            | HTTP | Category         | Condition                                                                                               |
| ----------------------------------------- | ---- | ---------------- | ------------------------------------------------------------------------------------------------------- |
| E_ACCOUNT_CREATE_CONFLICT                 | 500  | domain-admin     | Concurrent write conflict during account creation                                                       |
| E_ACCOUNT_NOT_FOUND                       | 404  | domain-admin     | No registered account found for the supplied `oid`                                                      |
| E_ADMIN_VERIFIED_METADATA_FIELD_NOT_FOUND | 404  | domain-admin     | Specified admin-verified metadata field does not exist for the user                                     |
| E_DELIVERY_TOKEN_CONSUMED                 | 403  | invitation       | Receipt-callback `delivery_token` has already been consumed by a prior callback                         |
| E_DELIVERY_TOKEN_EXPIRED                  | 403  | invitation       | Receipt-callback `delivery_token` is past its `expires_at`                                              |
| E_DELIVERY_TOKEN_INVALID                  | 403  | invitation       | Receipt-callback `delivery_token` does not match the stored token for the invitation                    |
| E_DOMAIN_ID_ASSIGN_CONFLICT               | 500  | domain-admin     | Concurrent write conflict during `domain_id` assignment                                                 |
| E_DUPLICATE_MESSAGE                       | 400  | submit           | Duplicate `message_id` within deduplication window (Section 5.1.1)                                      |
| E_EXPIRED                                 | 401  | mcp-auth         | Token is expired (`exp` claim in the past)                                                              |
| E_IMMUTABLE_FIELD_CONFLICT                | 400  | domain-admin     | Attempted to set or remove a field in the immutable namespace                                           |
| E_INSUFFICIENT_SCOPE                      | 403  | mcp-auth         | Required MCP scope(s) missing from the token                                                            |
| E_INTERNAL                                | 500  | mcp-tool         | Unhandled tool failure wrapped by the tool error handler                                                |
| E_INVALID_AUTH_HEADERS                    | 400  | submit           | Multiple identity headers present, or identity header does not match envelope `category`                |
| E_INVALID_AUDIENCE                        | 401  | mcp-auth         | Token audience does not match the expected audience                                                     |
| E_INVALID_BODY                            | 400  | message          | `application/json` body is not syntactically valid JSON (RFC 8259)                                      |
| E_INVALID_CONTENT_TYPE                    | 400  | message          | `content_type` value is not a permitted type (Section 7.1.2)                                            |
| E_INVALID_FORMAT                          | 401  | mcp-auth         | Authorization header format is invalid                                                                  |
| E_INVALID_ISSUER                          | 401  | mcp-auth         | Token issuer does not match the expected issuer                                                         |
| E_INVALID_KEY_FORMAT                      | 400  | mcp-auth         | JWKS key payload is malformed                                                                           |
| E_INVALID_MESSAGE_ENVELOPE                | 400  | submit           | Required message envelope fields missing or invalid                                                     |
| E_INVALID_ORIGIN                          | 400  | mcp-auth         | Origin header is invalid or does not match the expected origin                                          |
| E_INVALID_PAGE_SIZE                       | 400  | pagination       | Pagination `page_size` is invalid                                                                       |
| E_INVALID_RECEPTIVE_MODE                  | 400  | receptive-policy | Invalid receptive mode (must be `all`, `domain_filter`, `contact`, or `closed`; `receipt` is auto-only) |
| E_INVALID_REQUEST_BODY                    | 400  | submit           | Request body is not valid JSON                                                                          |
| E_INVALID_RESUME_TOKEN                    | 400  | pagination       | Pagination resume token is malformed or expired                                                         |
| E_INVALID_SIGNATURE                       | 401  | mcp-auth         | JWT signature validation failed                                                                         |
| E_INVALID_TOKEN_FORMAT                    | 401  | mcp-auth         | JWT structure is invalid (not three Base64URL segments)                                                 |
| E_INVALID_WINDOW_SCOPE                    | 400  | receptive-policy | Invalid receptive window scope (must be `all` or `domain_filter`)                                       |
| E_INVITATION_NOT_FOUND                    | 404  | invitation       | Invitation not found                                                                                    |
| E_INVITATION_NOT_PENDING                  | 400  | invitation       | Invitation cannot be accepted or rejected because it is not in `pending` status                         |
| E_JWKS_FETCH_FAILED                       | 401  | mcp-auth         | JWKS retrieval from the issuer failed                                                                   |
| E_KEY_NOT_FOUND                           | 401  | mcp-auth         | Signing key could not be resolved from JWKS                                                             |
| E_MESSAGE_TOO_LARGE                       | 413  | submit           | Request body exceeds 256 KB (Section 7.1.1)                                                             |
| E_MISSING_HEADER                          | 401  | mcp-auth         | Authorization header is missing                                                                         |
| E_MISSING_OID                             | 401  | mcp-auth         | Required `oid` claim is absent from the token                                                           |
| E_MISSING_RECEIPT_ID                      | 400  | submit           | `x-rpp-receipt-id` header missing                                                                       |
| E_MISSING_RECEPTIVE_POLICY_ID             | 400  | submit           | Invitation message missing `metadata.receptive_policy_id`                                               |
| E_MISSING_SIGNATURE                       | 400  | submit           | `x-rpp-signature` header missing                                                                        |
| E_MISSING_TIMESTAMP                       | 400  | submit           | `x-rpp-timestamp` header missing                                                                        |
| E_NOT_CONFIGURED                          | 500  | mcp-auth         | Auth subsystem is not configured on the server                                                          |
| E_NOT_YET_VALID                           | 401  | mcp-auth         | Token's `nbf` claim is in the future                                                                    |
| E_RECEIPT_ALREADY_REVOKED                 | 400  | receipt          | Receipt is already revoked                                                                              |
| E_RECEIPT_ENVELOPE_INVALID                | 400  | invitation       | Receipt envelope is missing required fields or has structurally invalid shape                           |
| E_RECEIPT_EXPIRED                         | 403  | submit           | Receipt has expired                                                                                     |
| E_RECEIPT_INVALID_SIGNATURE               | 403  | submit           | Request signature does not match the computed HMAC                                                      |
| E_RECEIPT_NOT_ACTIVE                      | 403  | receptive-policy | Referenced receipt is not active for receipt-based re-invitation                                        |
| E_RECEIPT_NOT_FOUND                       | 403  | submit           | Receipt id not recognized by this server                                                                |
| E_RECEIPT_NOT_FOUND                       | 404  | receipt          | Receipt not found in tool context                                                                       |
| E_RECEIPT_NOT_OWNED                       | 403  | receipt          | Receipt was not issued by this account                                                                  |
| E_RECEIPT_REVOKED                         | 403  | submit           | Receipt has been revoked                                                                                |
| E_RECEPTIVE_POLICY_CLOSED                 | 403  | receptive-policy | Receptive policy is closed to the supplied sender                                                       |
| E_RECEPTIVE_POLICY_EXPIRED                | 403  | receptive-policy | Receptive policy's `receptive_until` has passed                                                         |
| E_RECEPTIVE_POLICY_NOT_FOUND              | 403  | receptive-policy | Receptive policy not found for the supplied `receptive_policy_id`                                       |
| E_REQUEST_STALE                           | 400  | submit           | Timestamp outside the freshness window (Section 5.1.1)                                                  |
| E_SIGNATURE_VERIFICATION_FAILED           | 401  | mcp-auth         | Signature verification process failed                                                                   |
| E_UNSUPPORTED_ALGORITHM                   | 400  | mcp-auth         | JWT signing algorithm is not supported                                                                  |
| E_USER_VERIFIED_METADATA_NOT_FOUND        | 404  | domain-admin     | No verified metadata exists for the requested user                                                      |
| E_VERIFIED_METADATA_VALUE_TOO_LONG        | 400  | domain-admin     | Verified metadata value exceeds the 512-character limit                                                 |
| MISSING_AUTH                              | 401  | mcp-auth         | MCP request arrived without authentication context                                                      |

Notes:

- `E_RECEIPT_NOT_FOUND` is returned with HTTP 403 by the submit endpoint (where
  receipt existence is part of receipt authorization) and with HTTP 404 by
  receipt-management tools (where the code reflects a resource lookup miss).
  Implementations MUST honor the HTTP status appropriate to the subsystem.
- `MISSING_AUTH` is retained without the `E_` prefix for backward compatibility
  with early MCP clients; new codes SHOULD use the `E_` prefix.

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

An RPP server SHOULD expose a public domain identity endpoint that provides
metadata about the domain without revealing its users. Publishing this endpoint
allows cross-domain peers to discover exact endpoint URLs (Section 4.2) without
relying solely on path conventions.

- Path: `/.well-known/rpp-domain-identity`
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
  "envelope_endpoint": "https://cs.example-university.edu/rpp/v1/envelopes",
  "mcp_endpoint": "https://cs.example-university.edu/mcp",
  "public_key": {
    "algorithm": "Ed25519",
    "key": "MCowBQYDK2VwAyEA..."
  }
}
```

Fields:

| Field              | Required | Description                                           |
| ------------------ | -------- | ----------------------------------------------------- |
| domain             | REQUIRED | The RPP domain this identity describes                |
| display_name       | REQUIRED | Human-readable name for the domain                    |
| envelope_endpoint  | REQUIRED | Full HTTPS URL of the envelope endpoint (Section 4.2) |
| mcp_endpoint       | REQUIRED | Full HTTPS URL of the MCP endpoint (Section 4.2)      |
| domain_type        | OPTIONAL | Self-declared category (see Section 12.1.1)           |
| parent_domain      | OPTIONAL | Parent organization domain, if applicable             |
| categories_offered | OPTIONAL | Message categories this domain typically sends        |
| rpp_since          | OPTIONAL | Date the domain first began operating an RPP server   |
| contact_policy_url | OPTIONAL | URL for out-of-band administrative contact            |
| public_key         | OPTIONAL | Domain verification key (see Section 9.5)             |

Servers that do not publish a domain identity document are assumed to expose the
conventional endpoint paths defined in Section 4.2. Peers MAY fall back to those
paths when the `/.well-known/rpp-domain-identity` fetch fails with a 404.

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
