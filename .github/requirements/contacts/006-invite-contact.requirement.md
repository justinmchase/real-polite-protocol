---
id: contacts-006
title: invite_contact tool
spec_ref: "11.3, 10.3, 12.3"
---

## Requirement

The server MUST expose an `invite_contact` MCP tool that re-invites a known
contact via a fresh `receptive_policy_id` shared by that contact out-of-band
(§11.3, §10.3, §12.3).

RPP v0.3 does not preserve credentials across new invitations: every invitation
establishes a fresh bilateral credential pair on accept (§10.4, §11.1).
`invite_contact` therefore exists as a convenience wrapper around
`send_invitation` that uses the stored `remote_domain` of an existing contact,
sparing the caller from re-typing it.

## Rules

1. Takes `contact_id`, `receptive_policy_id`, `communication_terms`, and
   optionally `message`, `include_user_claims`, `include_admin_claims`,
   `custom_claims`, `verification`, `expires_at`.
2. Looks up the contact by `contact_id` for the authenticated account. If not
   found, return a structured not-found error.
3. If the contact is `blocked` (per `req:contacts-008`), the tool MUST reject
   with `E_CONTACT_BLOCKED` (§13) — a blocked contact cannot be re-invited until
   unblocked.
4. Uses `contact.remote_domain` as `receiver_domain` and performs the same flow
   as `send_invitation` (`req:invitations-005`), passing through the supplied
   `receptive_policy_id`, `communication_terms`, claim selectors, and optional
   fields. The local server MUST generate a fresh `reply_credential` for this
   invitation; it does NOT reuse the existing contact's `local_credential`
   (§10.1, §11.1).
5. Returns the same response shape as `send_invitation`:
   `{ invitation_id, sent_at }`.
6. If delivery to the remote's submit endpoint fails, return a structured error
   including the remote's error code when available.
