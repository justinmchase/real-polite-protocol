---
id: invitations-006
title: Senders can attach verified and custom claims to outgoing invitations
---

# Send Invitation — Claims

The `send_invitation` MCP tool MUST allow an authenticated listener to attach
optional **claims** to an outgoing invitation envelope. Claims give the receiver
contextual information about the sender to help them decide whether to accept.

Claims are divided by trust level. For **verified claims**, the caller declares
**which keys to include** and the server resolves the actual values from its own
database — the caller MUST NOT be able to supply the values for these claims.
For **unverified claims**, the caller supplies both keys and values directly,
but those claims MUST be clearly labeled as unverified so the receiver knows
they are self-declared.

## Claim Types

Four claim namespaces are supported on an invitation envelope:

| Namespace   | Source                                                                         | Trust level                                     |
| ----------- | ------------------------------------------------------------------------------ | ----------------------------------------------- |
| `immutable` | Server-assigned at account creation (e.g. `domain_id`); injected automatically | Highest — set by server, never overridable      |
| `user`      | Sender's authenticated identity token (stored as `user_verified_fields`)       | Verified by this server against the OAuth token |
| `admin`     | Set by the domain administrator (stored as `admin_verified_fields`)            | Asserted by the server admin                    |
| `custom`    | Caller-supplied free-form data                                                 | Unverified; treated as self-declared            |

## Claim Value Types

All claim namespaces share the same value schema. To keep message size bounded
and ensure values are reliably serializable, all claim values MUST conform to
the following constraints:

| Constraint             | Limit                                                             |
| ---------------------- | ----------------------------------------------------------------- |
| Allowed value types    | `string`, `number`, `boolean`, `null`, or a flat array of those   |
| String max length      | 512 characters per string value (including strings inside arrays) |
| Array max items        | 20 items per array value                                          |
| Nested objects         | NOT allowed — only scalars and flat arrays of scalars             |
| Max keys per namespace | 20 keys                                                           |
| Key max length         | 64 characters per key name                                        |

Servers MUST validate these constraints on inbound envelopes and reject (with a
structured error) any `send_invitation` call whose `custom_claims` violates
them. Servers MUST also enforce these constraints on server-resolved values
before writing them into the envelope.

## Tool Input Parameters

- `include_user_claims` (optional `string[]`) — keys of `user_verified_fields`
  the caller wishes to include. Only keys present in the stored record are
  included; missing keys are silently dropped.
- `include_admin_claims` (optional `string[]`) — keys of `admin_verified_fields`
  the caller wishes to include. Only keys present in the stored record are
  included; missing keys are silently dropped.
- `custom_claims` (optional `Record<string, ClaimValue>`) — arbitrary key-value
  data the caller provides directly. Passed through to the envelope without
  modification. The receiver MUST treat these as unverified.

The `immutable` namespace is always populated automatically by the server from
the sender's `immutable_fields` (e.g. `domain_id`). The caller cannot opt out.

## Expected Behavior

- The server always injects the sender's `immutable_fields` (e.g. `domain_id`)
  into the `immutable` namespace of the envelope claims, unconditionally.
- When `include_user_claims` is provided, the server fetches the caller's
  verified metadata by `oid` and builds a `user` map containing only the
  requested keys whose values exist in `user_verified_fields`.
- When `include_admin_claims` is provided, the server similarly builds an
  `admin` map from `admin_verified_fields`.
- When `custom_claims` is provided, its contents are included verbatim under the
  `custom` key in the envelope claims object. The server MUST validate value
  types and size limits before building the envelope.
- If a requested key does not exist in the stored metadata, it is **silently
  omitted** — the tool MUST NOT error on missing keys.
- If none of the inputs yield any claim data (e.g., all requested keys are
  missing from the database and no custom_claims provided), the `claims` field
  MUST still be present if `immutable` contains data; otherwise it is omitted.
- The caller MUST NOT be able to supply fabricated `user` or `admin` values
  directly; only keys are accepted as input, and the server is the sole source
  of the corresponding values.

## Envelope Shape

When claims are present, the invitation envelope's `invitation` object includes
a `claims` field:

```json
{
  "message_id": "...",
  "sender_domain": "sender.example",
  "category": "invitation",
  "sent_at": "2026-04-21T12:00:00Z",
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

The `immutable` namespace is always present — the server MUST include it on
every invitation envelope. The `user`, `admin`, and `custom` namespaces are
optional; only those with at least one entry are included.

## Security Properties

- `immutable` values are server-assigned and cannot be forged or overridden by
  any caller or administrator.
- `user` and `admin` values originate exclusively from the server's own verified
  metadata store — the caller selects which keys to expose, but MUST NOT supply
  or override the values.
- `custom` claims are caller-supplied. They MUST be clearly distinguished as
  unverified. Receivers MUST NOT treat them as authoritative.
- Claims are informational only. The receiver's acceptance decision is theirs
  alone; claims do not alter the protocol flow.

## Relationship to Domain-Verified Invitations (RFC Section 9.5)

The `claims` mechanism is a lighter-weight, unsigned companion to the
cryptographic `verification` attestation defined for public invitations (RFC
Section 9.5). The key differences are:

| Aspect          | `claims` (this requirement)           | `verification` (RFC 9.5)                              |
| --------------- | ------------------------------------- | ----------------------------------------------------- |
| Applies to      | Direct invitations                    | Public invitations                                    |
| Authenticity    | Server-resolved but unsigned          | Ed25519 signature by hosting domain                   |
| Receiver action | Informational; no verification step   | Receiver verifies signature against domain public key |
| Scope           | Any metadata key stored in the record | Fields the domain is willing to attest                |
