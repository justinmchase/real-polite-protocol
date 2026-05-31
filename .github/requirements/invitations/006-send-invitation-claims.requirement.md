---
id: invitations-006
title: Senders can attach verified and custom claims to outgoing invitations
spec_ref: "10.6, 10.7"
---

# Send Invitation — Claims

`send_invitation` and `invite_contact` MUST allow an authenticated local user to
attach optional **claims** to the outgoing invitation envelope. The same
mechanism applies to outbound `invitation_reply` envelopes constructed by
`accept_invitation` (§10.4, §10.6).

Claims give the remote contextual information about the sender to help them
decide whether to accept. Claims are divided by trust level. For **verified
claims**, the caller declares **which keys to include** and the server resolves
the actual values from its own database — the caller MUST NOT be able to supply
the values for these claims. For **unverified claims**, the caller supplies both
keys and values directly, but those claims MUST be clearly labeled as unverified
so the remote knows they are self-declared.

## Claim Types

Four claim namespaces are supported on an invitation envelope (§10.6):

| Namespace   | Source                                                                         | Trust level                                     |
| ----------- | ------------------------------------------------------------------------------ | ----------------------------------------------- |
| `immutable` | Server-assigned at account creation (e.g. `domain_id`); injected automatically | Highest — set by server, never overridable      |
| `user`      | Sender's authenticated identity token (stored as `user_verified_fields`)       | Verified by this server against the OAuth token |
| `admin`     | Set by the domain administrator (stored as `admin_verified_fields`)            | Asserted by the server admin                    |
| `custom`    | Caller-supplied free-form data                                                 | Unverified; treated as self-declared            |

## Claim Value Types

All claim namespaces share the same value schema. To keep envelope size bounded
and ensure values are reliably serializable, all claim values MUST conform to
the following constraints (§10.6):

| Constraint             | Limit                                                             |
| ---------------------- | ----------------------------------------------------------------- |
| Allowed value types    | `string`, `number`, `boolean`, `null`, or a flat array of those   |
| String max length      | 512 characters per string value (including strings inside arrays) |
| Array max items        | 20 items per array value                                          |
| Nested objects         | NOT allowed — only scalars and flat arrays of scalars             |
| Max keys per namespace | 20 keys                                                           |
| Key max length         | 64 characters per key name                                        |

Servers MUST validate these constraints on inbound envelopes and reject (with a
structured error) any call whose `custom_claims` violates them. Servers MUST
also enforce these constraints on server-resolved values before writing them
into the envelope.

## Tool Input Parameters

- `include_user_claims` (optional `string[]`) — keys of `user_verified_fields`
  the caller wishes to include. Only keys present in the stored record are
  included; missing keys are silently dropped.
- `include_admin_claims` (optional `string[]`) — keys of `admin_verified_fields`
  the caller wishes to include. Only keys present in the stored record are
  included; missing keys are silently dropped.
- `custom_claims` (optional `Record<string, ClaimValue>`) — arbitrary key-value
  data the caller provides directly. Passed through to the envelope without
  modification. The remote MUST treat these as unverified.

The `immutable` namespace is always populated automatically by the server from
the sender's `immutable_fields` (notably `domain_id`). The caller cannot opt
out.

## Expected Behavior

- The server always injects the sender's `immutable_fields` (notably
  `domain_id`) into the `immutable` namespace, unconditionally. `domain_id` is
  REQUIRED on every invitation and invitation_reply envelope (§10.1, §10.4) — it
  is the half of the composite identity key used by the remote to form a contact
  (§11).
- When `include_user_claims` is provided, the server fetches the caller's
  verified metadata by `oid` and builds a `user` map containing only the
  requested keys whose values exist in `user_verified_fields`.
- When `include_admin_claims` is provided, the server similarly builds an
  `admin` map from `admin_verified_fields`.
- When `custom_claims` is provided, its contents are included verbatim under the
  `custom` key. The server MUST validate value types and size limits before
  building the envelope.
- If a requested key does not exist in the stored metadata, it is **silently
  omitted** — the tool MUST NOT error on missing keys.
- The caller MUST NOT be able to supply fabricated `user` or `admin` values
  directly; only keys are accepted as input, and the server is the sole source
  of the corresponding values.

## Envelope Shape

When claims are present, the envelope includes a `claims` object:

```json
{
  "category": "invitation",
  "envelope_id": "...",
  "sender_domain": "sender.example",
  "sent_at": "2026-05-30T12:00:00Z",
  "invitation_id": "...",
  "communication_terms": {
    "categories": ["billing"],
    "max_content_rating": "PG"
  },
  "reply_credential": { "contact_id": "...", "contact_secret": "..." },
  "claims": {
    "immutable": { "domain_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6" },
    "user": { "name": "Alice Smith", "email": "alice@sender.example" },
    "admin": { "institution": "Example University" },
    "custom": { "note": "We met at the conference" }
  }
}
```

The `immutable` namespace is always present. The `user`, `admin`, and `custom`
namespaces are optional; only those with at least one entry are included.

## Security Properties

- `immutable` values are server-assigned and cannot be forged or overridden by
  any caller or administrator.
- `user` and `admin` values originate exclusively from the server's own verified
  metadata store — the caller selects which keys to expose, but MUST NOT supply
  or override the values.
- `custom` claims are caller-supplied. They MUST be clearly distinguished as
  unverified. Remotes MUST NOT treat them as authoritative.
- Claims are informational only. The remote's acceptance decision is theirs
  alone; claims do not alter the protocol flow.

## Relationship to Domain Verification (§10.7)

The `claims` mechanism is the lightweight, unsigned payload. The optional
`verification` block (§10.7) is a separate cryptographic Ed25519 attestation
that lets the remote verify selected verified-claim values against a published
domain JWKS. They are complementary:

| Aspect          | `claims` (this requirement)       | `verification` (§10.7)                            |
| --------------- | --------------------------------- | ------------------------------------------------- |
| Authenticity    | Server-resolved but unsigned      | Ed25519 signature by hosting domain               |
| Receiver action | Informational; no signature check | Receiver verifies against `/.well-known/rpp/jwks` |
| Scope           | Any metadata key on the record    | Fields the domain is willing to attest            |
