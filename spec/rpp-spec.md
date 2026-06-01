# Real Polite Protocol (RPP)

Document: RPP Core Specification\
Status: Internet-Draft\
Version: 0.3.0-draft\
Last Updated: 2026-05-30

## Abstract

The Real Polite Protocol (RPP) is an HTTP-based messaging protocol intended as a
replacement for email-style communication between software agents and services.
RPP is "polite" because unsolicited delivery is disallowed at the protocol
layer: a remote sender MUST either target an open receptive policy the local
domain has published, or hold a contact relationship the local domain has
previously consented to.

This document is written from the perspective of a single RPP server — the
**local domain**. All other RPP servers are **remote domains**. Terms like
"local user", "inbound", "outbound", "local contact", and "remote sender" are
used throughout.

RPP defines:

- a single backend-to-backend HTTP POST endpoint for envelope submission
  (messages, invitations, and invitation replies),
- an MCP endpoint for authenticated local-user listener connections,
- a simple bilateral contact model: two domains exchange invitation + invitation
  reply to establish a mutual contact relationship, and from then on exchange
  messages signed with per-contact secrets.

## 1. Conformance Language

The key words MUST, MUST NOT, REQUIRED, SHALL, SHALL NOT, SHOULD, SHOULD NOT,
RECOMMENDED, MAY, and OPTIONAL in this document are to be interpreted as
described in RFC 2119 and RFC 8174.

## 2. Scope and Goals

RPP defines:

- bilateral message delivery between one remote sender and one local recipient,
- receptive-policy-based gating for first contact,
- a contact-based permission model that replaces the email "address book" with
  an explicitly negotiated, mutually-consented relationship,
- authenticated MCP access for listener-oriented workflows on the local domain,
- standardized message categories and content ratings.

RPP does not define:

- human-facing mailbox UX or storage layout,
- reputation, trust scores, or directories of users,
- group conversations (deferred to a future revision).

## 3. Core Entities

- **Local domain**: the RPP server described by this document instance.
- **Remote domain**: any other RPP server.
- **Local user**: an account owner on the local domain.
- **Remote sender**: an account owner on a remote domain, identified across
  domains by `(domain, domain_id)`.
- **Receptive policy**: a local user's standing or time-bounded declaration of
  willingness to receive invitations (§9).
- **Invitation**: a `category: "invitation"` envelope offering to establish a
  contact relationship (§10).
- **Invitation reply**: a `category: "invitation_reply"` envelope sent by the
  local domain to the remote sender's domain when the local user accepts an
  invitation (§10.4).
- **Contact**: the local domain's record of a consented relationship with a
  remote sender. Holds the credentials each side uses to message the other
  (§11).
- **Block**: a flag on a contact that causes the local domain to reject all
  further inbound envelopes from that remote sender (§11.4).

## 4. User Identity Model

RPP deliberately avoids email-style addresses. There is no protocol-level
username, mailbox identifier, or structured address format. The local domain
routes inbound envelopes by **contact id**, never by user address. Invitations
target a **receptive policy id**, never an address.

### 4.1 Domains as the Only Protocol-Level Identity

The only identity that crosses domain boundaries at the protocol level is the
**domain name** — a DNS hostname (e.g., `remote.example`). Domain names MUST be
valid DNS hostnames and are always lowercase.

Local users are local to the local domain. The protocol does not define,
require, or transmit any user-level identifier across domain boundaries.

**OID privacy invariant.** Local accounts are identified internally by an opaque
server-assigned OID (typically from an OIDC token). OIDs are strictly local:
they MUST NOT appear in any data transmitted to a remote domain. OIDs MAY appear
in MCP tool responses returned to the account owner or the local domain
administrator. The only cross-domain identity artifacts defined by this protocol
are `domain` (a DNS hostname) and `domain_id` (a UUID scoped to that domain).

### 4.2 Domain ID

A `domain_id` is a UUID assigned by the local domain to each local user. The
local domain includes this value in every outbound invitation and invitation
reply, in the immutable claim namespace (§10.6). It is the stable cross-domain
identity of a local user, scoped to the local domain.

`domain_id` is NOT globally unique. Two different domains MAY independently
assign the same UUID to different users; these are not the same identity. All
identity comparisons MUST use the composite key `(domain, domain_id)`.

### 4.3 Display Names

A local user MAY present themselves with a **display name**: any Unicode string
of their choosing.

- Display names are OPTIONAL.
- Display names MAY be any Unicode string (spaces, emoji, non-Latin scripts).
- Display names MUST NOT exceed 256 Unicode code points.
- Display names MUST NOT be used for routing, authentication, or authorization.
  They are cosmetic.
- A local user MAY use different display names in different invitations.

## 5. Transport Model

### 5.1 Transport Security

All RPP traffic between domains MUST be carried over HTTPS (TLS). Servers MUST
NOT accept or deliver envelopes over plain HTTP in production.

**Exception:** `localhost` deployments MAY use plain HTTP for local development.

### 5.2 Required Endpoints

The local domain MUST expose two HTTP endpoints:

1. **Envelope endpoint** (backend-to-backend):
   - Method: POST
   - Path: implementation-defined (RECOMMENDED: `/rpp/v1/envelopes`)
   - Purpose: Accept one envelope per request. Envelopes carry `message`,
     `invitation`, or `invitation_reply` payloads (§8).

2. **MCP endpoint** (local listener interface):
   - Transport: MCP over HTTP
   - Path: implementation-defined (RECOMMENDED: `/mcp`)
   - Purpose: Authenticated send/receive and workflow orchestration for local
     listeners connected to the local domain.

Cross-domain peers identify each other by **domain** (DNS hostname). Peers
SHOULD fetch the domain identity endpoint (§14.1) to discover the exact endpoint
URLs before first contact.

### 5.3 Envelope Cardinality

- Each envelope MUST identify exactly one remote sender and exactly one local
  recipient.
- Fanout MUST be expressed as multiple independent envelope submissions.

## 6. Authentication and Authorization

### 6.1 Envelope Endpoint Authentication

The envelope endpoint authenticates each POST with an HMAC-SHA-256 signature
bound to the request body and timestamp. The credential and identity header vary
by envelope kind:

| Envelope kind      | Identity header             | HMAC key source                                                         |
| ------------------ | --------------------------- | ----------------------------------------------------------------------- |
| `message`          | `x-rpp-contact-id`          | `contact_secret` issued by the local domain for the named contact       |
| `invitation_reply` | `x-rpp-contact-id`          | `contact_secret` issued by the remote domain in the original invitation |
| `invitation`       | `x-rpp-receptive-policy-id` | none — the policy id itself is the bearer credential (see below)        |

Invitations are the first-contact case: there is no prior shared secret with the
remote sender. The `receptive_policy_id` (or its `shortcode` alias, §9.2) acts
as a bearer capability. The local domain MUST treat the policy id as
secret-bearing and MUST only accept invitations whose policy id resolves to an
active policy on the local domain. A future revision MAY tighten this to require
HMAC over a policy-scoped key.

Every HMAC-signed request MUST include:

- `x-rpp-signature` — lowercase-hex HMAC-SHA-256 of the canonical input below,
  using the key resolved from the identity header.
- `x-rpp-timestamp` — ISO 8601 UTC timestamp of when the request was created
  (see §6.1.1).

Canonical HMAC input:

```
HMAC_SHA256(key=<resolved-key>, data=x-rpp-timestamp + "." + request_body_bytes)
```

The local domain resolves the key by:

1. Reading the identity header.
2. Looking up the corresponding record (contact for `x-rpp-contact-id`) and
   extracting its `contact_secret`.
3. Computing the HMAC over the canonical input.
4. Comparing constant-time against `x-rpp-signature`.

Exactly one identity header MUST be present per request, and it MUST match the
envelope `category`. Mismatches MUST be rejected with `E_INVALID_AUTH_HEADERS`.

The local domain MUST reject requests with missing, unknown, malformed, expired,
blocked, or policy-violating credentials. The canonical list of RPP error codes
is defined in §13.2.

HTTP status conventions on the envelope endpoint:

- 400 — syntactic and structural request errors.
- 403 — credential authorization failures (unknown contact, blocked contact,
  closed policy, signature mismatch).
- 413 — body exceeds the protocol maximum size (§8.1.1).

#### 6.1.1 Replay Protection

RPP combines timestamp freshness and envelope-id deduplication to defeat replay
attacks.

**Timestamp freshness.** Every envelope request MUST include an
`x-rpp-timestamp` header containing an ISO 8601 UTC timestamp. The local domain
MUST reject any request whose timestamp differs from the local server's current
UTC time by more than **60 seconds** with `E_REQUEST_STALE`.

**Envelope deduplication.** The local domain MUST maintain a deduplication cache
keyed by envelope identity:

- `message` envelopes: deduplicated by `(sender_domain, message_id)`.
- `invitation` envelopes: deduplicated by `(sender_domain, invitation_id)`.
- `invitation_reply` envelopes: deduplicated by
  `(sender_domain, invitation_id)`.

Duplicates within the dedup window MUST be rejected with `E_DUPLICATE_ENVELOPE`.
The cache MUST retain entries for at least 60 seconds.

### 6.2 MCP Endpoint Authentication

The MCP endpoint MUST require authentication. RPP adopts the MCP authorization
specification, which is based on OAuth 2.1 with bearer tokens.

#### 6.2.1 Standards Baseline

- OAuth 2.1 (draft-ietf-oauth-v2-1-13),
- OAuth 2.0 Protected Resource Metadata (RFC 9728),
- OAuth 2.0 Authorization Server Metadata (RFC 8414),
- OAuth 2.0 Dynamic Client Registration Protocol (RFC 7591),
- Resource Indicators for OAuth 2.0 (RFC 8707).

#### 6.2.2 Bearer Token Requirement

Every HTTP request from a local listener on the MCP endpoint MUST include an
`Authorization: Bearer <access-token>` header. Tokens MUST NOT be sent in query
parameters or request bodies. The header MUST be present on every request,
including initialization.

#### 6.2.3 Token Validation

The local domain MUST validate, on every request:

- token signature against the issuer's JWKS,
- `iss` matches the configured issuer,
- `aud` matches the configured resource indicator,
- `exp` and `nbf` claims are within tolerance,
- the `oid` claim is present and resolves to a local account.

#### 6.2.4 Authorization Server Discovery

The local domain MUST publish OAuth 2.0 Protected Resource Metadata at
`/.well-known/oauth-protected-resource` identifying the authorization server.

#### 6.2.5 Error Codes

All MCP authentication error codes appear in §13.2 with category `mcp-auth`.

## 7. Categories and Ratings

### 7.1 Category Registry

This draft defines the following initial message categories:

- `correspondence` — general person-to-person or entity-to-entity messages
- `billing` — invoices, payment confirmations, payment failures
- `marketing` — promotional content, offers, newsletters
- `event` — event invitations, reminders, updates, cancellations
- `security` — password resets, 2FA codes, login alerts
- `transactional` — order confirmations, shipping updates, appointments
- `legal` — terms-of-service changes, compliance notices
- `support` — help desk replies, ticket updates

In addition, two **reserved control categories** identify non-message envelopes
(§8):

- `invitation` — proposes a new contact relationship
- `invitation_reply` — accepts (and reciprocates) an invitation

The local domain MAY apply stricter local policy but SHOULD NOT redefine the
semantics of interoperable category values.

### 7.2 Content Rating Registry

Content ratings form a strict total order. A contact's accepted
`max_content_rating` means "this level and everything below it".

| Rating | Ordinal | Description                                         |
| ------ | ------- | --------------------------------------------------- |
| G      | 0       | General — suitable for all audiences                |
| PG     | 1       | Mildly sensitive — may reference sensitive topics   |
| M      | 2       | Mature — contains mature or professional themes     |
| R      | 3       | Restricted — contains explicit or sensitive content |

## 8. Envelope Model

The envelope endpoint accepts a single JSON envelope per POST. Every envelope
has a top-level `category` field that selects one of three **envelope kinds**:

| `category`                       | Kind             | Purpose                                | Section |
| -------------------------------- | ---------------- | -------------------------------------- | ------- |
| `invitation`                     | invitation       | Propose a new contact relationship     | §10     |
| `invitation_reply`               | invitation reply | Accept (and reciprocate) an invitation | §10.4   |
| any value from §7.1 message list | message          | Ordinary user-facing message           | §8.1    |

### 8.1 Message Envelope

A `message`-kind envelope carries a normal user-facing message body:

```json
{
  "message_id": "019644a1-7e2a-7b3c-8d1e-1f2a3b4c5d6e",
  "sender_domain": "remote.example",
  "sender_display_name": "Alice Johnson",
  "category": "billing",
  "content_rating": "G",
  "sent_at": "2026-05-30T12:00:00Z",
  "subject": "Invoice 1042",
  "body": {
    "content_type": "text/markdown",
    "content": "Please find attached..."
  },
  "metadata": {}
}
```

- `message_id` MUST be a UUIDv7 (RFC 9562) and MUST be unique per
  `sender_domain`. `(sender_domain, message_id)` is the canonical message
  identifier. The local domain MUST reject duplicates.
- `sender_domain` MUST be a valid DNS hostname. It MUST match the `domain` field
  on the contact resolved from `x-rpp-contact-id`.
- `sender_display_name` is OPTIONAL informational text only.
- The local recipient is identified by the contact resolved from the
  `x-rpp-contact-id` header. There is no recipient field in the envelope.
- `category` MUST be one value from §7.1 (and MUST NOT be `invitation` or
  `invitation_reply`).
- `content_rating` MUST be one value from §7.2.
- `metadata` is OPTIONAL (§8.1.3).

#### 8.1.1 Maximum Envelope Size

The maximum HTTP request body size is **256 KB**. The local domain MUST reject
larger requests with HTTP 413 and `E_ENVELOPE_TOO_LARGE`. This limit is
protocol-mandatory and not configurable. Large content MUST be referenced by URL
rather than embedded.

#### 8.1.2 Message Body Content Type

The `body` object MUST contain a `content_type` and `content`. RPP defines two
permitted content types:

- **`text/markdown`** — UTF-8 Markdown conforming to CommonMark. Senders MUST
  NOT embed raw HTML.
- **`application/json`** — UTF-8 string containing a syntactically valid JSON
  document whose top-level value is an object or array. The local domain MUST
  validate syntactic well-formedness and reject malformed JSON with
  `E_INVALID_BODY` (HTTP 400).

Any other `content_type` MUST be rejected with `E_INVALID_CONTENT_TYPE`.

Receiving clients MUST NOT render JSON content as Markdown.

#### 8.1.3 Message Metadata

> **Sub-protocol extension point.** `metadata` is intentionally left open for
> higher-level protocols. It is NOT part of the core RPP contract.

`metadata` is OPTIONAL on a message envelope. When present it MUST be a JSON
object. When absent or null it is treated as `{}`.

The local domain MUST pass `metadata` through unmodified — it MUST NOT strip,
transform, or interpret its contents.

To bound envelope size, `metadata` values MUST conform to:

| Constraint          | Limit                                                             |
| ------------------- | ----------------------------------------------------------------- |
| Allowed value types | `string`, `number`, `boolean`, `null`, or a flat array of those   |
| String max length   | 512 characters per string value (including strings inside arrays) |
| Array max items     | 20 items per array value                                          |
| Nested objects      | NOT allowed                                                       |
| Max keys            | 20 keys                                                           |
| Key max length      | 64 characters per key name                                        |

Violations MUST be rejected with `E_INVALID_MESSAGE_ENVELOPE` (HTTP 400).

Receivers MUST treat all `metadata` values as unverified caller-supplied data.

#### 8.1.4 Outbox Storage

When a local listener successfully sends a message, the local domain MUST store
a local outbox record on the sender's account. The record MUST include
`message_id`, `receiver_domain`, `contact_id`, `category`, `content_rating`,
`sent_at`, `subject`, `body`, `metadata`, and a `status` of `"delivered"` on 2xx
or `"failed"` on non-2xx.

Outbox records are private to the local account and MUST NOT be visible to other
accounts or via the envelope endpoint.

### 8.2 Response Shape

Successful envelope acceptance MUST return HTTP 202 or 200 with:

```json
{ "ok": true, "accepted": true, "envelope_id": "..." }
```

`envelope_id` is the envelope's primary identifier:

- `message_id` for `message` envelopes,
- `invitation_id` for `invitation` and `invitation_reply` envelopes.

Errors follow §13.

## 9. Receptive Policies

A remote sender MAY only send an invitation to the local domain by targeting an
open receptive policy. The local domain MUST refuse any inbound invitation that
does not resolve to an active policy.

A local user creates one or more **receptive policies**. Each policy has a
unique `policy_id` (UUID). Policies stack — a local user MAY have multiple
active policies simultaneously.

Each policy specifies a `mode`:

- `all` — receptive to all invitations
- `domain_filter` — receptive to invitations whose `sender_domain` passes a
  glob-based allow/block list (§9.3)
- `contact` — receptive only to senders identified by an explicit
  `(domain, domain_id)` allow list (§9.4)
- `closed` — explicitly closed; always rejects with `E_RECEPTIVE_POLICY_CLOSED`

> **No `deactivated` state.** Policies are deleted when no longer wanted. The
> local user removes them explicitly via `remove_receptive_policy`. The default
> state when a local user has no policies is closed.

### 9.1 Time-Bounded Receptive Windows

A local user MAY open a time-bounded receptive window by calling
`open_receptive_window`. This creates a policy with:

- `policy_id` — a UUID
- `receptive_until` — ISO 8601 timestamp after which the policy expires
- `mode` — `all` or `domain_filter`
- `shortcode` — a human-shareable 8-character alias (§9.2)

Opening a window does NOT replace existing policies. Windows stack. The local
user MAY remove a window early via `remove_receptive_policy`.

Invitations targeting an expired window MUST be rejected with
`E_RECEPTIVE_POLICY_EXPIRED`.

### 9.2 Receptive Window Shortcode

`open_receptive_window` MUST generate a **shortcode**: a human-readable alias
for the `policy_id`.

**Format.** Exactly 8 characters from `[a-z0-9]`, randomly generated. With ~2.8
trillion possibilities (36⁸), in-domain collisions are negligible.

**Uniqueness.** The local domain MUST ensure shortcode uniqueness at the time of
creation. On collision, retry up to a reasonable maximum (RECOMMENDED 10).

**Sharing.** The MCP tool response MUST include `shortcode` and the local domain
hostname. The local listener UI MUST present both in copyable form.

**Remote usage.** A remote sender MAY supply `shortcode` + `receiver_domain` in
lieu of `receptive_policy_id` in an invitation envelope. The local domain MUST
resolve the shortcode to the underlying `policy_id` before applying all standard
policy checks.

If the shortcode is unknown, return `E_RECEPTIVE_POLICY_NOT_FOUND`. If the
resolved policy is expired, return `E_RECEPTIVE_POLICY_EXPIRED`.

Shortcodes are only generated for time-bounded windows. Standing policies
created via `add_receptive_policy` are referenced by UUID.

When a policy is deleted, the shortcode index entry MUST be removed in the same
atomic operation.

### 9.3 Domain Filters

A `domain_filter` policy uses an ordered list of `allow`/`block` rules, each
with a glob pattern. Rules are evaluated top-to-bottom; the first match wins. If
no rule matches, the domain is blocked (implicit
`{ "action": "block", "pattern": "*" }` always appended).

| Character | Meaning                                               |
| --------- | ----------------------------------------------------- |
| `*`       | Matches zero or more characters within a single label |
| `**`      | Matches zero or more entire labels (including dots)   |
| `?`       | Matches exactly one character                         |

Example:

```json
{
  "rules": [
    { "action": "block", "pattern": "spammer.example" },
    { "action": "allow", "pattern": "*.example-university.edu" },
    { "action": "allow", "pattern": "**.gov" }
  ]
}
```

Matching is case-insensitive. `*` MUST NOT match the `.` label separator. To
allow all, use `{ "action": "allow", "pattern": "*" }`. An empty rules list
blocks all senders.

### 9.4 Contact-Based Receptivity

A `contact` mode policy MUST include `contacts`: an array of
`(domain, domain_id)` pairs. An inbound invitation matches only if its
`(sender_domain, claims.immutable.domain_id)` exactly equals one entry
(case-insensitive on domain, exact on domain_id).

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

Failure MUST be rejected with `E_RECEPTIVE_POLICY_CLOSED`.

Contact-mode policies are useful for re-invitations from a known remote sender
(for example, a sender that wants to refresh their `contact_secret` after
rotation).

**Immutability.** A contact-mode policy's `contacts` list is fixed. To change
membership, delete the policy and create a replacement; the replacement receives
a new `policy_id`.

### 9.5 QR Code and URI-Based Opt-In

The local domain MAY present a machine-readable invitation link (QR, NFC, deep
link) that encodes:

- the local domain hostname,
- a `policy_id` or `shortcode` referencing an active receptive policy.

The encoded URI MUST use this scheme:

```
rpp://local.example/invite?shortcode=ab12cd34
```

When a remote scanner activates the link, the remote client MUST display context
to the remote user before submitting an invitation. Auto-acceptance of
QR-presented policies is NOT permitted.

## 10. Invitations

An invitation is a `category: "invitation"` envelope that proposes a new contact
relationship. The remote sender's domain POSTs the envelope to the local
domain's envelope endpoint, targeting a `receptive_policy_id` or `shortcode` the
local user has opened.

The full lifecycle is:

```
remote sender                          local domain
  invitation envelope  ──────────────▶  resolve policy
                                        store pending invitation
                                        notify local listener
                                        ┌──────────────────────────┐
                                        │ local user reviews:      │
                                        │  - accept                │
                                        │  - reject                │
                                        │  - let expire            │
                                        └──────────────────────────┘
                                        on accept:
                                        - create local contact
                                        - send invitation_reply  ─▶  back to remote
```

### 10.1 Invitation Envelope

```json
{
  "category": "invitation",
  "invitation_id": "019644a1-7e2a-7b3c-8d1e-1f2a3b4c5d6e",
  "sender_domain": "remote.example",
  "sender_display_name": "Alice",
  "receptive_policy_id": "...", // OR "shortcode": "ab12cd34"
  "sent_at": "2026-05-30T12:00:00Z",
  "expires_at": "2026-06-30T12:00:00Z",

  "communication_terms": {
    "categories": ["billing", "transactional"],
    "max_content_rating": "PG"
  },

  "reply_credential": {
    "contact_id": "...",
    "contact_secret": "<≥128 bits, hex>"
  },

  "claims": {
    "immutable": { "domain_id": "..." },
    "user": { "name": "Alice Smith" },
    "admin": { "institution": "Example U" },
    "custom": { "note": "We met at the conference" }
  },

  "verification": null, // optional, see §10.7
  "message": "Hi — would you like to stay in touch?"
}
```

Required fields: `category`, `invitation_id`, `sender_domain`,
`receptive_policy_id` **or** `shortcode`, `sent_at`, `communication_terms`,
`reply_credential`, `claims.immutable.domain_id`.

Optional fields: `sender_display_name`, `expires_at`, `claims.user`,
`claims.admin`, `claims.custom`, `verification`, `message`.

The `reply_credential` is the credential the **local domain** will use when
POSTing an `invitation_reply` (or any later `message`) to the remote sender's
domain:

- `contact_id` — opaque string, generated by the remote sender's domain, scoped
  to that domain.
- `contact_secret` — random key, ≥128 bits, generated by the remote sender's
  domain. The remote sender MUST treat this as single-purpose: it is the HMAC
  key for all envelopes the local domain sends to the remote sender's domain
  through this contact relationship.

The remote sender MUST persist `(invitation_id, contact_id, contact_secret)`
locally so it can authenticate the eventual `invitation_reply` and subsequent
messages.

`communication_terms` MUST include `categories` (non-empty array drawn from §7.1
message categories) and `max_content_rating` (one value from §7.2). These terms
describe what the remote sender is willing to send. Term enforcement is soft
(§11.5).

`expires_at` is OPTIONAL. If omitted, the invitation does not expire and remains
`pending` until the local user acts or the remote sender cancels it.

`message` is an OPTIONAL freeform human-readable introduction. It is
informational only.

### 10.2 Invitation Lifecycle

Invitation state transitions on the local domain:

- `pending` → `accepted` (local user accepted; contact created; invitation_reply
  dispatched)
- `pending` → `rejected` (local user rejected; no reply dispatched)
- `pending` → `expired` (no action before `expires_at`)
- `pending` → `cancelled` (remote sender cancelled by sending a fresh
  `invitation` with the same `invitation_id` and `cancelled: true` — see §10.3)

The terminal states (`accepted`, `rejected`, `expired`, `cancelled`) are final;
no further transitions occur.

### 10.3 Remote Cancellation

A remote sender MAY cancel a pending invitation by re-submitting an `invitation`
envelope with the same `invitation_id` and a top-level `"cancelled": true`
field. The local domain MUST transition the invitation to `cancelled`. If the
invitation has already reached a terminal state, the local domain MUST respond
with `E_INVITATION_NOT_PENDING`.

### 10.4 Invitation Reply

When a local user accepts a `pending` invitation, the local domain MUST:

1. Create a local contact record (§11) using the invitation's
   `(sender_domain, claims.immutable.domain_id)` as the identity key and the
   invitation's `communication_terms`, `claims`, and `reply_credential` (which
   becomes the credential the local domain uses for outbound).
2. Generate a new `local_credential = (contact_id, contact_secret)` scoped to
   the local domain. This is what the **remote sender** will use to send inbound
   messages to the local domain through this contact.
3. POST an `invitation_reply` envelope back to the remote sender's domain.

`invitation_reply` envelope:

```json
{
  "category": "invitation_reply",
  "invitation_id": "<the original invitation_id>",
  "sender_domain": "local.example",
  "sender_display_name": "Bob",
  "sent_at": "2026-05-30T12:05:00Z",

  "communication_terms": {
    "categories": ["correspondence"],
    "max_content_rating": "G"
  },

  "reply_credential": {
    "contact_id": "...",
    "contact_secret": "<≥128 bits, hex>"
  },

  "claims": {
    "immutable": { "domain_id": "..." },
    "user": { "name": "Bob Jones" },
    "custom": {}
  },

  "verification": null,
  "message": "Happy to connect!"
}
```

Field semantics mirror §10.1, applied from the perspective of the local domain
as the now-replying party. Notably:

- `invitation_id` MUST equal the original invitation's id; it links the reply to
  the prior request.
- `reply_credential` is the **local** domain's credential that the remote sender
  uses for inbound to the local domain.
- `communication_terms` are the local user's own terms — what the local user is
  willing to send to the remote.

**Authentication.** The local domain signs the `invitation_reply` using the
`reply_credential.contact_secret` from the original invitation, with header
`x-rpp-contact-id: <reply_credential.contact_id from the invitation>`.

**On the remote sender's side**, receipt of a valid `invitation_reply` MUST:

- Mark the original invitation `accepted` on the remote sender's outbox.
- Create a contact record mirroring the local domain's contact — storing
  `(local_domain, claims.immutable.domain_id)`, the local user's
  `communication_terms`, claims, and the local domain's `reply_credential` as
  the credential to use for further outbound to the local domain.

After this exchange, both sides hold a contact record for the other and each
holds the other's contact credential. They MAY exchange `message` envelopes
freely subject to soft term enforcement (§11.5) and blocking (§11.4).

### 10.5 Rejection and Silence

Rejection is silent. The local domain MUST NOT send any envelope to inform the
remote sender of a rejection or of expiry. The remote sender SHOULD treat
prolonged silence as a soft rejection.

Local users MAY block the remote sender (§11.4) at any point during or after an
invitation; blocking does not produce an outbound envelope either.

### 10.6 Sender Claims

A remote sender MAY attach optional **claims** to invitation and
invitation_reply envelopes. Four claim namespaces are defined:

| Namespace   | Trust level               | Source                                                                                                                                                                                                |
| ----------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `immutable` | Highest — domain-assigned | Values injected automatically by the sender's domain from the sender's `immutable_fields` (e.g. `domain_id`). The caller MUST NOT supply this namespace. The sender's domain MUST always populate it. |
| `user`      | Server-attested           | Values from the sender's authenticated identity token, stored as `user_verified_fields` and resolved by the sender's domain. The caller MUST NOT supply values.                                       |
| `admin`     | Admin-attested            | Values set by the sender's domain administrator, stored as `admin_verified_fields` and resolved by the sender's domain. The caller MUST NOT supply values directly.                                   |
| `custom`    | Unverified                | Caller-supplied free-form data. The receiver MUST treat these as self-declared with no independent verification.                                                                                      |

The `immutable` namespace MUST be present on every invitation and
invitation_reply. The other namespaces are OPTIONAL.

#### 10.6.1 Claim Value Constraints

All values within `claims` (any namespace) MUST conform to:

| Constraint             | Limit                                                             |
| ---------------------- | ----------------------------------------------------------------- |
| Allowed value types    | `string`, `number`, `boolean`, `null`, or a flat array of those   |
| String max length      | 512 characters per string value (including strings inside arrays) |
| Array max items        | 20 items per array value                                          |
| Nested objects         | NOT allowed                                                       |
| Max keys per namespace | 20 keys                                                           |
| Key max length         | 64 characters per key name                                        |

Violations MUST be rejected with `E_INVALID_INVITATION_ENVELOPE` (HTTP 400).

#### 10.6.2 Receiver Obligations

- The receiver MUST NOT treat `custom` values as verified or authoritative.
- The receiver SHOULD surface the trust level of each namespace to the user.
- The receiver MAY use claim values to inform their accept/reject decision.
- The receiver MAY ignore claims entirely.

### 10.7 Domain-Verified Invitations

The sender's domain MAY attach a cryptographic `verification` attestation to an
invitation or invitation_reply confirming that the `claims` values match the
sender domain's records.

#### 10.7.1 Domain Verification Key

To support verification, the sender's domain MUST publish a public key in its
domain identity endpoint (§14.1) with:

| Field     | Required | Description                                                      |
| --------- | -------- | ---------------------------------------------------------------- |
| algorithm | REQUIRED | MUST be `Ed25519`.                                               |
| key       | REQUIRED | Base64-encoded public key in SubjectPublicKeyInfo (SPKI) format. |

The corresponding private key MUST be kept secret and used only for signing
verification attestations.

If the sender's domain rotates its verification key, previously-issued
signatures become unverifiable unless the sender's domain serves historical
keys.

#### 10.7.2 Verification Attestation

```json
{
  "verification": {
    "verified_fields": {
      "name": "Dr. Alice Smith",
      "institution": "Example University"
    },
    "verified_at": "2026-05-30T10:00:00Z",
    "domain": "cs.example-university.edu",
    "key_id": "key_2026_05",
    "signature": "base64-encoded-Ed25519-signature"
  }
}
```

The signature MUST be computed over the canonical JSON payload (keys sorted
alphabetically, no extraneous whitespace):

```json
{
  "domain": "cs.example-university.edu",
  "invitation_id": "019644a1-...",
  "verified_at": "2026-05-30T10:00:00Z",
  "verified_fields": {
    "institution": "Example University",
    "name": "Dr. Alice Smith"
  }
}
```

#### 10.7.3 Verification Rules

- The sender's domain MUST only sign fields whose values match its own records.
  If a stored display name is "Alice Smith" but the invitation says "Bob Jones",
  the sender's domain MUST NOT sign that field.
- The sender's domain MAY verify any subset of fields. Only fields present in
  `verified_fields` are attested.
- The sender's domain MUST re-sign or strip the `verification` block when any
  attested field changes.

#### 10.7.4 Verification by the Local Domain

When the local domain (or the local user) encounters an invitation with a
`verification` object:

1. Fetch the remote domain's public key from `/.well-known/rpp-domain-identity`.
2. Reconstruct the canonical payload from the invitation.
3. Verify the Ed25519 signature.
4. If verification succeeds, treat `verified_fields` as domain-attested.
5. If verification fails, treat all claims as unverified self-declaration.

Verification is informational. A successful verification means the remote domain
attests the metadata is accurate in its records — it does NOT mean the metadata
is true in any absolute sense. Trust in verification is bounded by trust in the
remote domain.

## 11. Contacts

The local domain maintains a per-account **contact book**. A contact is the
local domain's record of a consented relationship with a remote sender.

### 11.1 Contact Model

| Field               | Type                                   | Description                                                                                                      |
| ------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `id`                | UUID string                            | Stable local identifier for the contact record.                                                                  |
| `owner_oid`         | string                                 | OID of the local account that owns this contact.                                                                 |
| `remote_domain`     | string                                 | Remote sender's domain. Immutable once set.                                                                      |
| `remote_domain_id`  | UUID string                            | Remote sender's `domain_id` (scoped to `remote_domain`). Immutable once set.                                     |
| `remote_terms`      | object                                 | The `communication_terms` declared by the remote sender (categories + max_content_rating).                       |
| `local_terms`       | object                                 | The `communication_terms` declared by the local user when reciprocating.                                         |
| `local_credential`  | `{ contact_id, contact_secret }`       | Credential the **remote** uses to sign envelopes inbound to the local domain.                                    |
| `remote_credential` | `{ contact_id, contact_secret }`       | Credential the **local** domain uses to sign envelopes outbound to the remote domain.                            |
| `fields`            | `Record<string, ContactFieldRecord[]>` | Claim values harvested from invitations and invitation_replies, newest-first per field key.                      |
| `blocked`           | boolean                                | When true, the local domain MUST reject all inbound envelopes whose `x-rpp-contact-id` resolves to this contact. |
| `created_at`        | ISO 8601                               | When the contact was first created.                                                                              |
| `updated_at`        | ISO 8601                               | When the contact was last updated.                                                                               |

The composite key `(owner_oid, remote_domain, remote_domain_id)` is the logical
unique key. The local domain MUST index and look up contacts by the full
composite key; matching on `remote_domain_id` alone is invalid.

A `ContactFieldRecord` holds one historical value for a claim field:

| Field         | Type                                                                           | Description                                                                                                                                                                                |
| ------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `value`       | string, number, boolean, null, or array                                        | The claim value as received.                                                                                                                                                               |
| `source`      | `"sender_verified"` \| `"domain_admin"` \| `"sender_custom"` \| `"owner_note"` | `"sender_verified"` for `claims.user`; `"domain_admin"` for `claims.admin`; `"sender_custom"` for `claims.custom`; `"owner_note"` when the contact owner added it via `set_contact_field`. |
| `recorded_at` | ISO 8601                                                                       | When this value was recorded.                                                                                                                                                              |

### 11.2 Contact Creation Paths

The local domain MUST create or update a contact in exactly two situations:

1. **Local user accepts an inbound invitation.** §10.4 step 1.
2. **Inbound `invitation_reply` arrives for an outbound invitation the local
   domain sent.** The local domain MUST locate the original invitation by
   `invitation_id`, then create a contact for the remote sender using
   `(remote_domain, claims.immutable.domain_id)` as the identity key. The
   reply's `reply_credential` becomes the local domain's `remote_credential`
   (used to send outbound). The credential the local domain originally generated
   when sending the invitation becomes the contact's `local_credential` (used by
   the remote sender for inbound).

In both cases the local domain MUST:

- Merge `claims.user` (source `"sender_verified"`), `claims.admin`
  (`"domain_admin"`), and `claims.custom` (`"sender_custom"`) into `fields`,
  prepending a new `ContactFieldRecord` per key. Existing history entries are
  never replaced.
- Record `remote_terms` (from the inbound envelope) and `local_terms` (the local
  user's own proposed terms from the reply).
- Set `created_at` on first creation and `updated_at` on every change.

`remote_domain` and `remote_domain_id` MUST NOT be modified after creation.

Receiving a `message` envelope does NOT modify any contact field other than
`updated_at`. New claim values are only harvested from invitation /
invitation_reply envelopes.

### 11.3 Inbound Envelope Routing

When a `message` or `invitation_reply` envelope arrives with `x-rpp-contact-id`,
the local domain MUST:

1. Look up the contact whose `local_credential.contact_id` equals the header
   value.
2. If no contact is found, reject with `E_CONTACT_NOT_FOUND`.
3. If the contact is `blocked`, reject with `E_CONTACT_BLOCKED`.
4. Verify the HMAC using `local_credential.contact_secret`.
5. Verify the envelope's `sender_domain` equals the contact's `remote_domain`
   (case-insensitive). On mismatch, reject with `E_SENDER_DOMAIN_MISMATCH`.
6. For `message` envelopes, route the message to the inbox of `owner_oid` and
   surface the contact identity.
7. For `invitation_reply` envelopes, follow the steps in §11.2 path 2.

### 11.4 Block / Unblock

The local user MAY block a contact at any time via the `block_contact` MCP tool.
When a contact is blocked:

- `blocked` is set to `true`.
- All subsequent inbound envelopes from the contact MUST be rejected with
  `E_CONTACT_BLOCKED`.
- The local domain does NOT send any outbound envelope to notify the remote
  sender.
- The local user MAY still send outbound messages to the contact unless they
  also delete the contact.

The local user MAY unblock a contact, which clears `blocked` and restores
inbound delivery.

The local user MAY delete a contact entirely via `delete_contact`. Deletion
removes the credential mapping; any subsequent inbound envelope from the remote
sender will fail with `E_CONTACT_NOT_FOUND`. This is functionally equivalent to
a permanent block.

### 11.5 Soft Term Enforcement

`remote_terms` and `local_terms` are soft enforcement signals — each side
declared what they are willing to send. The local domain SHOULD surface
violations to the local user but is not required to reject envelopes that exceed
declared terms.

- The local domain SHOULD warn the local listener when an inbound message's
  `category` is not in `remote_terms.categories`, or when its `content_rating`
  exceeds `remote_terms.max_content_rating`.
- The local domain SHOULD prevent the local user from sending an outbound
  message that exceeds `local_terms`, but MAY allow override with explicit
  confirmation.

If the local user feels a remote sender repeatedly violates their declared
terms, the appropriate remedy is to **block** the contact (§11.4). There is no
protocol-level renegotiation handshake. To revise terms with a willing remote
sender, the local user may send a fresh invitation (or the remote sender may),
and both parties' contact records will be updated when the new exchange
completes.

### 11.6 Field Accumulation and Flat-Merge Presentation

Each entry in `fields` is an array of `ContactFieldRecord`, ordered
newest-first. The local domain MUST preserve all historical entries.

When presenting a contact (e.g., `list_contacts`, `get_contact`):

- **Flat merge**: present only the most recent value for each field as
  `current_fields` — a simple map from field name to `ContactFieldRecord`.
- **Full history**: `get_contact` MUST also return the raw `fields` array per
  key so callers can inspect change history.

The contact owner MAY add custom fields at any time via `set_contact_field`
(source `"owner_note"`).

## 12. MCP Tool Catalog

This section defines the RECOMMENDED MCP tools the local domain SHOULD expose to
authenticated local listeners. Tools are grouped by role. Domain management
tools require the domain administrator role.

All tools require OAuth 2.1 bearer token authentication (§6.2).

### 12.0 Tool Output Format

Every tool that returns structured data MUST declare an `outputSchema` (JSON
Schema) and MUST include both:

1. `structuredContent` — the structured result, conforming to `outputSchema`.
2. `content` — a `type: "text"` item containing the JSON-serialized
   `structuredContent` for clients without structured-output support.

### 12.1 Messaging Tools

| Tool                 | Description                                                                                                                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `send_message`       | Compose and send a message to one of the local user's contacts. The local domain performs HMAC signing using the contact's `remote_credential` and POSTs to the remote domain's envelope endpoint. |
| `list_messages`      | List messages in the local user's inbox, with filters for category, contact, date range, and read/unread.                                                                                          |
| `list_sent_messages` | List the local user's outbox records (§8.1.4).                                                                                                                                                     |
| `get_message`        | Retrieve a single message by `message_id`.                                                                                                                                                         |
| `mark_read`          | Mark one or more messages as read.                                                                                                                                                                 |
| `delete_message`     | Delete an inbox or outbox record from local storage.                                                                                                                                               |

### 12.2 Invitation Tools

| Tool                    | Description                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list_invitations`      | List pending, accepted, rejected, expired, and cancelled invitations the local user has **received**, with filters for sender domain and status.                                                                                                                                                                                                                 |
| `review_invitation`     | Retrieve full details of a single invitation including `communication_terms`, claims, and verification status.                                                                                                                                                                                                                                                   |
| `accept_invitation`     | Accept a pending invitation. The local user MUST supply their own `communication_terms` (categories + max_content_rating). The local domain creates a contact (§11) and dispatches an `invitation_reply` to the remote domain (§10.4).                                                                                                                           |
| `reject_invitation`     | Reject a pending invitation. No outbound envelope is sent (§10.5).                                                                                                                                                                                                                                                                                               |
| `send_invitation`       | Send an `invitation` envelope to a remote domain. Caller supplies `receiver_domain`, `receptive_policy_id` or `shortcode`, `communication_terms`, optional `expires_at`, optional `custom_claims` (subject to §10.6.1), optional intro `message`, and an option to attach `verification`. The local domain generates the `invitation_id` and `reply_credential`. |
| `cancel_invitation`     | Cancel a pending invitation previously sent by the local user, by submitting a cancellation envelope to the remote domain (§10.3).                                                                                                                                                                                                                               |
| `list_sent_invitations` | List invitations the local user has sent and their current status.                                                                                                                                                                                                                                                                                               |

### 12.3 Receptive Policy Tools

| Tool                      | Description                                                                                                                                                                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_receptive_policies`  | List the local user's receptive policies.                                                                                                                                                                                                      |
| `add_receptive_policy`    | Add a standing policy with mode `all`, `domain_filter`, `contact`, or `closed`.                                                                                                                                                                |
| `open_receptive_window`   | Create a time-bounded receptive policy (§9.1) and return its `policy_id` and `shortcode` (§9.2). RECOMMENDED for proximity and ad-hoc first-contact flows. The agent MUST present `shortcode` + local domain to the listener in copyable form. |
| `remove_receptive_policy` | Permanently delete a receptive policy. Subsequent invitations referencing the deleted policy fail with `E_RECEPTIVE_POLICY_NOT_FOUND`.                                                                                                         |

### 12.4 Contact Tools

| Tool                | Description                                                                                                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list_contacts`     | List the local user's contacts, returning `current_fields` per contact, plus identity, terms, and `blocked` state.                                                          |
| `get_contact`       | Retrieve a single contact including full field history.                                                                                                                     |
| `delete_contact`    | Permanently delete a contact. Removes credential mappings; subsequent inbound envelopes from the remote sender are rejected with `E_CONTACT_NOT_FOUND`.                     |
| `block_contact`     | Set `blocked = true` on a contact (§11.4).                                                                                                                                  |
| `unblock_contact`   | Set `blocked = false` on a contact (§11.4).                                                                                                                                 |
| `set_contact_field` | Add an owner-authored custom field to a contact. Prepends a new `ContactFieldRecord` with `source: "owner_note"` to the field's history. Does not replace existing history. |

### 12.5 Identity Tools

| Tool                         | Description                                                                                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `get_display_name`           | Retrieve the local user's current default display name.                                                                                                                        |
| `set_display_name`           | Set or clear the local user's default display name.                                                                                                                            |
| `set_user_verified_metadata` | Refresh the caller's `user_verified_fields` from the authenticated token claims. The tool MUST replace the prior user-sourced map and MUST NOT modify `admin_verified_fields`. |

### 12.6 Domain Management — Identity and Configuration

These tools require the domain administrator role.

| Tool                      | Description                                                                                                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_domain_identity`     | Retrieve the current domain identity (§14.1).                                                                                                                        |
| `update_domain_identity`  | Update `display_name`, `domain_type`, `parent_domain`, `categories_offered`, `contact_policy_url`.                                                                   |
| `rotate_verification_key` | Generate a new Ed25519 keypair (§10.7.1). Archive the previous key. Existing attestations signed with the old key become unverifiable unless historical keys served. |
| `get_verification_key`    | Retrieve the current public verification key and `key_id`.                                                                                                           |
| `list_historical_keys`    | List archived verification keys (paged). Used to verify older attestations.                                                                                          |
| `delete_historical_key`   | Remove an archived verification key. Attestations signed with the deleted key become permanently unverifiable.                                                       |

### 12.7 Domain Management — User Verification

These tools require the domain administrator role and manage the records the
local domain consults when attesting `verification` on outbound invitations
(§10.7).

Verified metadata has three sources:

- `immutable_fields` — assigned by the local domain at account creation (e.g.
  `domain_id`). Write-once.
- `user_verified_fields` — derived from the authenticated user's identity token.
- `admin_verified_fields` — supplied by a domain administrator.

Effective merge precedence: `user_verified_fields` < `admin_verified_fields` <
`immutable_fields`.

| Tool                             | Description                                                                                                                                                                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list_verifiable_users`          | List users whose metadata the local domain can verify. Paged.                                                                                                                                                                                                 |
| `get_user_verified_metadata`     | Retrieve the verified metadata record for a specific user, including the three source maps and the effective merged view.                                                                                                                                     |
| `set_admin_verified_metadata`    | Set or update admin-supplied verified metadata. Fields in `immutable_fields` MUST NOT be settable here — reject with `E_IMMUTABLE_FIELD_CONFLICT`.                                                                                                            |
| `remove_admin_verified_metadata` | Remove a specific field from admin verified metadata. Fields in `immutable_fields` MUST NOT be removable — reject with `E_IMMUTABLE_FIELD_CONFLICT`. The local domain MUST re-sign or strip outbound `verification` blocks that referenced the removed field. |

### 12.8 Domain Management — Contact Information

| Tool                     | Description                                                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_contact_policy_url` | Retrieve the current `contact_policy_url` from domain identity.                                                                              |
| `set_contact_policy_url` | Set or update the `contact_policy_url`. This is the sole out-of-band channel for domain-administrator-to-domain-administrator communication. |

### 12.9 Pagination

All MCP list tools MUST use **resume-token-based** pagination. Offset-based
pagination MUST NOT be used.

Request parameters:

- `page_size` (optional integer) — number of entries requested.
- `resume_token` (optional string) — opaque token from a prior call.

Response shape:

- `<items_field>` — tool-specific array (e.g., `messages`, `contacts`).
- `next_resume_token` (optional string) — opaque token for the next page; absent
  when no more results.

Rules:

- Resume tokens MUST be treated as opaque by clients.
- The local domain SHOULD provide a stable traversal order per tool.
- The local domain MUST reject malformed or expired tokens with
  `E_INVALID_RESUME_TOKEN`.

## 13. Error Model

All error responses MUST use `Content-Type: application/json` with:

```json
{
  "ok": false,
  "error": {
    "code": "E_CONTACT_BLOCKED",
    "message": "Contact <id> is blocked."
  }
}
```

- `code` MUST be a registered code from §13.2.
- `message` SHOULD be a human-readable explanation; wording MAY vary between
  implementations.

### 13.1 MCP Endpoint Error Structures

#### 13.1.1 HTTP/MCP Authentication Errors

```json
{
  "ok": false,
  "error": "Insufficient scope",
  "code": "E_INSUFFICIENT_SCOPE",
  "metadata": { "expectedAnyOf": ["api://.../rpp.tools.read"] }
}
```

`code` MUST be a `mcp-auth` entry from §13.2.

#### 13.1.2 MCP Tool Errors

```json
{
  "ok": false,
  "error": {
    "name": "ContactNotFoundError",
    "status": 404,
    "code": "E_CONTACT_NOT_FOUND",
    "message": "No contact found for id ..."
  }
}
```

#### 13.1.3 JSON-RPC/MCP Protocol Errors

Use standard JSON-RPC numeric codes (-32700 parse error, -32600 invalid request,
-32601 method not found, -32602 invalid params, -32603 internal error).

### 13.2 RPP Error Code Registry

| RPP Error Code                            | HTTP | Category         | Condition                                                                       |
| ----------------------------------------- | ---- | ---------------- | ------------------------------------------------------------------------------- |
| E_ACCOUNT_CREATE_CONFLICT                 | 500  | domain-admin     | Concurrent write conflict during account creation                               |
| E_ACCOUNT_NOT_FOUND                       | 404  | domain-admin     | No registered account found for the supplied `oid`                              |
| E_ADMIN_VERIFIED_METADATA_FIELD_NOT_FOUND | 404  | domain-admin     | Specified admin-verified metadata field does not exist for the user             |
| E_CONTACT_BLOCKED                         | 403  | submit           | Contact resolved from `x-rpp-contact-id` is blocked                             |
| E_CONTACT_NOT_FOUND                       | 403  | submit           | `x-rpp-contact-id` does not resolve to any contact                              |
| E_CONTACT_NOT_FOUND                       | 404  | contact          | Contact not found in tool context                                               |
| E_DOMAIN_ID_ASSIGN_CONFLICT               | 500  | domain-admin     | Concurrent write conflict during `domain_id` assignment                         |
| E_DUPLICATE_ENVELOPE                      | 400  | submit           | Duplicate envelope identifier within deduplication window (§6.1.1)              |
| E_ENVELOPE_TOO_LARGE                      | 413  | submit           | Request body exceeds 256 KB (§8.1.1)                                            |
| E_EXPIRED                                 | 401  | mcp-auth         | Token is expired (`exp` claim in the past)                                      |
| E_IMMUTABLE_FIELD_CONFLICT                | 400  | domain-admin     | Attempted to set or remove a field in the immutable namespace                   |
| E_INSUFFICIENT_SCOPE                      | 403  | mcp-auth         | Required MCP scope(s) missing from the token                                    |
| E_INTERNAL                                | 500  | mcp-tool         | Unhandled tool failure                                                          |
| E_INVALID_AUDIENCE                        | 401  | mcp-auth         | Token audience does not match the expected audience                             |
| E_INVALID_AUTH_HEADERS                    | 400  | submit           | Identity header missing, duplicated, or mismatched against envelope `category`  |
| E_INVALID_BODY                            | 400  | message          | `application/json` body is not syntactically valid JSON (RFC 8259)              |
| E_INVALID_CONTENT_TYPE                    | 400  | message          | `content_type` is not a permitted type (§8.1.2)                                 |
| E_INVALID_FORMAT                          | 401  | mcp-auth         | Authorization header format is invalid                                          |
| E_INVALID_INVITATION_ENVELOPE             | 400  | submit           | Required invitation envelope fields missing or invalid                          |
| E_INVALID_ISSUER                          | 401  | mcp-auth         | Token issuer does not match the expected issuer                                 |
| E_INVALID_KEY_FORMAT                      | 400  | mcp-auth         | JWKS key payload is malformed                                                   |
| E_INVALID_MESSAGE_ENVELOPE                | 400  | submit           | Required message envelope fields missing or invalid                             |
| E_INVALID_ORIGIN                          | 400  | mcp-auth         | Origin header is invalid or does not match the expected origin                  |
| E_INVALID_PAGE_SIZE                       | 400  | pagination       | Pagination `page_size` is invalid                                               |
| E_INVALID_RECEPTIVE_MODE                  | 400  | receptive-policy | Invalid receptive mode (must be `all`, `domain_filter`, `contact`, or `closed`) |
| E_INVALID_REPLY_CREDENTIAL                | 400  | submit           | `reply_credential` missing or malformed in invitation / invitation_reply        |
| E_INVALID_REQUEST_BODY                    | 400  | submit           | Request body is not valid JSON                                                  |
| E_INVALID_RESUME_TOKEN                    | 400  | pagination       | Pagination resume token is malformed or expired                                 |
| E_INVALID_SIGNATURE                       | 401  | mcp-auth         | JWT signature validation failed                                                 |
| E_INVALID_TOKEN_FORMAT                    | 401  | mcp-auth         | JWT structure is invalid                                                        |
| E_INVALID_WINDOW_SCOPE                    | 400  | receptive-policy | Invalid receptive window scope (must be `all` or `domain_filter`)               |
| E_INVITATION_NOT_FOUND                    | 404  | invitation       | Invitation not found                                                            |
| E_INVITATION_NOT_PENDING                  | 400  | invitation       | Invitation is not in `pending` status                                           |
| E_JWKS_FETCH_FAILED                       | 401  | mcp-auth         | JWKS retrieval from the issuer failed                                           |
| E_KEY_NOT_FOUND                           | 401  | mcp-auth         | Signing key could not be resolved from JWKS                                     |
| E_MISSING_CONTACT_ID                      | 400  | submit           | `x-rpp-contact-id` header missing                                               |
| E_MISSING_HEADER                          | 401  | mcp-auth         | Authorization header is missing                                                 |
| E_MISSING_OID                             | 401  | mcp-auth         | Required `oid` claim is absent from the token                                   |
| E_MISSING_RECEPTIVE_POLICY_ID             | 400  | submit           | Invitation envelope missing `receptive_policy_id` and `shortcode`               |
| E_MISSING_SIGNATURE                       | 400  | submit           | `x-rpp-signature` header missing                                                |
| E_MISSING_TIMESTAMP                       | 400  | submit           | `x-rpp-timestamp` header missing                                                |
| E_NOT_CONFIGURED                          | 500  | mcp-auth         | Auth subsystem is not configured on the local domain                            |
| E_NOT_YET_VALID                           | 401  | mcp-auth         | Token's `nbf` claim is in the future                                            |
| E_RECEPTIVE_POLICY_CLOSED                 | 403  | receptive-policy | Receptive policy is closed to the supplied sender                               |
| E_RECEPTIVE_POLICY_EXPIRED                | 403  | receptive-policy | Receptive policy's `receptive_until` has passed                                 |
| E_RECEPTIVE_POLICY_NOT_FOUND              | 403  | receptive-policy | Receptive policy not found for the supplied id or shortcode                     |
| E_REQUEST_STALE                           | 400  | submit           | Timestamp outside the freshness window (§6.1.1)                                 |
| E_SENDER_DOMAIN_MISMATCH                  | 403  | submit           | Envelope `sender_domain` does not match the resolved contact's `remote_domain`  |
| E_SIGNATURE_INVALID                       | 403  | submit           | Request signature does not match the computed HMAC                              |
| E_SIGNATURE_VERIFICATION_FAILED           | 401  | mcp-auth         | Signature verification process failed                                           |
| E_UNSUPPORTED_ALGORITHM                   | 400  | mcp-auth         | JWT signing algorithm is not supported                                          |
| E_USER_VERIFIED_METADATA_NOT_FOUND        | 404  | domain-admin     | No verified metadata exists for the requested user                              |
| E_VERIFIED_METADATA_VALUE_TOO_LONG        | 400  | domain-admin     | Verified metadata value exceeds the 512-character limit                         |
| MISSING_AUTH                              | 401  | mcp-auth         | MCP request arrived without authentication context                              |

`E_CONTACT_NOT_FOUND` is returned with HTTP 403 by the envelope endpoint (where
contact resolution is part of credential authorization) and with HTTP 404 by
contact-management tools (where it reflects a resource lookup miss).

`MISSING_AUTH` is retained without the `E_` prefix for backward compatibility
with early MCP clients; new codes SHOULD use the `E_` prefix.

## 14. Domain Identity

RPP's contact model prevents unsolicited messages between previously unrelated
parties. This section defines a domain-level identity endpoint that helps remote
parties assess the local domain before sending an invitation.

Trust, reputation, and domain-to-domain administrative communication are
deliberately left outside the protocol. The `contact_policy_url` field provides
an out-of-band channel for any administrative matters (abuse reports, legal
notices, operational coordination) between domain operators.

### 14.1 Domain Self-Identification Endpoint

The local domain SHOULD expose a public domain identity endpoint that provides
metadata about the local domain without revealing local users.

- Path: `/.well-known/rpp-domain-identity`
- Method: GET
- Authentication: NONE

Response shape:

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

| Field              | Required | Description                                         |
| ------------------ | -------- | --------------------------------------------------- |
| domain             | REQUIRED | The local domain this identity describes            |
| display_name       | REQUIRED | Human-readable name                                 |
| envelope_endpoint  | REQUIRED | Full HTTPS URL of the envelope endpoint             |
| mcp_endpoint       | REQUIRED | Full HTTPS URL of the MCP endpoint                  |
| domain_type        | OPTIONAL | Self-declared category (see §14.1.1)                |
| parent_domain      | OPTIONAL | Parent organization domain, if applicable           |
| categories_offered | OPTIONAL | Message categories this domain typically sends      |
| rpp_since          | OPTIONAL | Date the domain first began operating an RPP server |
| contact_policy_url | OPTIONAL | URL for out-of-band administrative contact          |
| public_key         | OPTIONAL | Domain verification key (§10.7)                     |

Servers that do not publish a domain identity document are assumed to expose the
conventional endpoint paths defined in §5.2.

#### 14.1.1 Domain Type Registry

| Type       | Description                                           |
| ---------- | ----------------------------------------------------- |
| personal   | Individual or family domain                           |
| business   | Commercial entity                                     |
| academic   | University, research institution, or educational body |
| government | Government agency or public-sector body               |
| nonprofit  | Non-governmental organization or charity              |
| healthcare | Medical provider, insurer, or health institution      |
| media      | News, journalism, or publishing organization          |

Domain types are self-declared and informational only.

### 14.2 Privacy Considerations

The domain identity endpoint MUST NOT expose user lists, user identifiers,
contact lists, or message metadata.

## 15. Versioning and Compatibility

- The protocol version string is `major.minor.patch`.
- Breaking changes increment major.
- Backward-compatible additions increment minor.
- Editorial clarifications increment patch.

## 16. Security Considerations

- TLS is REQUIRED in production.
- Per-contact `contact_secret` values are bearer credentials and MUST be
  protected at rest and in transit with the same rigor as any other shared
  secret.
- The signature verification MUST be performed over the exact raw request body
  bytes, prefixed with the timestamp and period separator (§6.1).
- Domain verification keys (§10.7.1) MUST be protected with the same rigor as
  TLS private keys. Compromise of a domain verification key allows an attacker
  to forge identity attestations for any local user.
- Clients verifying invitation attestations MUST fetch remote domain public keys
  over HTTPS and SHOULD cache them no longer than the TTL indicated by standard
  HTTP caching headers.
- Blocking is local: it stops the local domain from accepting further inbound
  envelopes from a remote sender. It does not (and cannot) prevent the remote
  sender from continuing to attempt delivery.
- The replay protection window (§6.1.1) requires reasonably synchronized clocks.
  Servers SHOULD use NTP or equivalent.

## 17. Deployment Architecture

RPP server implementations SHOULD deploy one server instance per domain to
ensure data isolation by design:

- **Data isolation by design** — each domain's storage is isolated at the
  infrastructure level.
- **Simplified access control** — no need to namespace storage by domain id.
- **Independent scaling and versioning**.
- **Compliance and auditability** — easier to satisfy data residency
  requirements, audit trails, and regulatory regimes (GDPR, HIPAA).
- **Reduced blast radius** — a bug or incident in one instance affects only that
  domain.

Implementations MAY use a multi-tenant deployment if isolation is enforced
through strong namespace discipline (prefixing all persistent records with a
domain identifier) and strict access controls. Multi-tenant deployments MUST:

- Include domain id as a prefix in all primary keys.
- Verify domain membership before granting access to domain-specific resources.
- Enforce quotas and rate limits per domain, not globally.
- Test multi-domain scenarios to prevent cross-domain data access.

Single-tenant-per-instance deployments are strongly preferred.

## 18. Open Questions

- Group conversations: deferred. May reintroduce as a separate sub-protocol
  layered on the contact model.
- Verification key rotation: standardized historical key endpoint format and
  maximum key age for verifying older attestations.
- Display name abuse: whether the local domain should enforce any content policy
  on display names presented in invitations.
- Rate limiting first-contact invitations against open `all`-mode policies.
- Mass-block / domain-level block lists: how to express "block every contact
  from `spammer.example`" without iterating per contact.
