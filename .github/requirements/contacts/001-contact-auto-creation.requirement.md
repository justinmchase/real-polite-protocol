---
id: contacts-001
title: Contact auto-creation on invitation acceptance
spec_ref: "11.1, 11.2, 10.4"
---

## Requirement

A local contact record (§11) MUST be created (or upserted) automatically by the
local domain in exactly two situations:

1. **Local accept** — when the local user accepts a pending inbound invitation
   via `accept_invitation` (§10.4, `req:invitations-003`).
2. **Remote accept** — when the local domain receives an inbound
   `invitation_reply` envelope (§10.4) confirming that a remote local user
   accepted an invitation our user previously sent.

No other event creates a contact. Receiving a `message` envelope does NOT create
a contact; messages are only routable if a contact already exists (§7,
`req:submit-001`).

## Rules

1. The composite identity key is `(owner_oid, remote_domain, remote_domain_id)`
   — the local account OID, the remote's RPP domain, and the remote's
   `claims.immutable.domain_id` from the envelope (§11.1).
2. The contact `id` is a server-assigned synthetic UUID, distinct from any
   remote identifier.
3. `remote_domain` and `remote_domain_id` MUST both be stored and MUST NOT be
   modified on subsequent upserts. Together they are the immutable identity key
   (§11.1).
4. The contact stores a **bilateral credential pair** (§6.1, §11.1):
   - `local_credential = (contact_id, contact_secret)` — generated locally;
     given to the remote (via the outbound envelope's `reply_credential` field)
     so the remote can sign **inbound** envelopes to this domain.
   - `remote_credential = (contact_id, contact_secret)` — supplied by the remote
     in either the inbound invitation's or inbound invitation_reply's
     `reply_credential` field; used by this domain to sign **outbound**
     envelopes to the remote.
5. The contact stores two `communication_terms`-shaped records (§11.5):
   - `local_terms` — categories + `max_content_rating` the local user is willing
     to **send**. Set from the local user's choice at `accept_invitation` time
     or from the local user's choice at `send_invitation` time.
   - `remote_terms` — categories + `max_content_rating` the remote user is
     willing to **send**, sourced from the remote envelope's
     `communication_terms`.
6. Claims from the inbound envelope (`user`, `admin`, `custom`) MUST be
   accumulated into the contact's `fields` history per `req:contacts-002`.
7. `blocked` defaults to `false` on creation (see `req:contacts-008`).
8. `created_at` is set on first creation; `updated_at` is refreshed on every
   upsert. On second-and-subsequent encounters (e.g. a re-invitation that
   resolves to the same `(remote_domain, remote_domain_id)`), the contact is
   upserted in place — a new record is NOT created.
9. If an inbound invitation envelope has no `claims.immutable.domain_id`, the
   envelope MUST be rejected at submit time and no contact is created
   (`domain_id` is required on invitation / invitation_reply envelopes per
   §10.1, §10.4).
