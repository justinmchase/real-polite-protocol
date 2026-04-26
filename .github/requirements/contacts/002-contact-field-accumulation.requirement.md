---
id: contacts-002
title: Contact field accumulation from invitation claims
spec_ref: "10C.3"
---

## Requirement

On each invitation acceptance the server MUST merge the invitation's `user`,
`admin`, and `custom` claim namespaces into the contact's `fields` map, keeping
full history per field key.

## Rules

1. For each `(key, value)` in the accepted invitation's `claims.user`,
   `claims.admin`, and `claims.custom`, prepend a `ContactFieldRecord` to the
   history array for that key. Never delete or overwrite existing history
   entries.
2. Each record stores `value`, `source` (`"sender_verified"` for `claims.user`,
   `"domain_admin"` for `claims.admin`, or `"sender_custom"` for
   `claims.custom`), and `recorded_at` (the acceptance timestamp).
3. The contact owner (authenticated user) MAY add a custom field at any time via
   `set_contact_field`. These records use `source: "owner_note"` and
   `recorded_at` set to the time of the call.
4. The flat-merge view MUST present only the most-recent `ContactFieldRecord`
   per key (index `[0]` of each history array) under `current_fields`.
5. `get_contact` MUST return the full `fields` history.
