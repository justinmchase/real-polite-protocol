---
id: contacts-002
title: Contact field accumulation from envelope claims
spec_ref: "11.2, 10.6"
---

## Requirement

On each event that creates or updates a contact (§11.1, §11.2) the server MUST
merge the triggering envelope's `user`, `admin`, and `custom` claim namespaces
(§10.6) into the contact's `fields` map, keeping full history per field key.

The triggering envelope is:

- The inbound `invitation` envelope on local accept (`req:invitations-003`); OR
- The inbound `invitation_reply` envelope on remote accept
  (`req:invitations-invitation-reply`).

For an outbound `send_invitation` that the local user originated, no contact is
created until the remote replies, so the outbound claims do NOT modify any
contact at send time.

## Rules

1. For each `(key, value)` in the envelope's `claims.user`, `claims.admin`, and
   `claims.custom`, prepend a `ContactFieldRecord` to the history array for that
   key. Never delete or overwrite existing history entries (§11.2).
2. Each record stores `value`, `source` (`"sender_verified"` for `claims.user`,
   `"domain_admin"` for `claims.admin`, or `"sender_custom"` for
   `claims.custom`), and `recorded_at` (the upsert timestamp).
3. The contact owner (authenticated local user) MAY add a custom field at any
   time via `set_contact_field` (`req:contacts-007`). These records use
   `source: "owner_note"` and `recorded_at` set to the time of the call.
4. The flat-merge view MUST present only the most-recent `ContactFieldRecord`
   per key (index `[0]` of each history array) under `current_fields`.
5. `get_contact` MUST return the full `fields` history.
6. `immutable` claims (e.g. `domain_id`) MUST NOT be merged into `fields` — they
   form the contact's identity key (`req:contacts-001`) and are stored
   separately.
