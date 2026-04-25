---
id: contacts-001
title: Contact auto-creation on invitation acceptance
spec_ref: "10C.2"
---

## Requirement

When an invitation carrying `claims.immutable.domain_id` is accepted, the server
MUST upsert a contact record owned by the receiver account.

## Rules

1. The unique contact key is `(owner_oid, sender_domain, domain_id)` — the
   composite of the receiver account OID, the invitation's `sender_domain`, and
   the `domain_id` UUID from `claims.immutable`. Matching on `domain_id` alone
   is invalid.
2. The contact `id` MUST be a server-assigned synthetic UUID, distinct from the
   sender's `domain_id`.
3. `domain_id` (the value from `claims.immutable.domain_id`) MUST be stored as a
   separate field on the contact record.
4. `owner_oid` is the OID of the receiver account.
5. The contact's `domain` field MUST be set to the invitation's `sender_domain`
   at first creation and MUST NOT be modified on subsequent upserts. `domain` is
   an immutable identity key once stored.
6. `created_at` is set on first creation; `updated_at` is refreshed on every
   upsert.
7. If the invitation has no `claims.immutable.domain_id`, no contact is created.
8. Receiving a message via the submit endpoint does NOT create a contact.
9. `domain_id` is similarly immutable: it is written at contact creation and
   MUST NOT be changed on update. Together `domain` and `domain_id` form the
   composite key that was used to locate (or create) the contact record.
