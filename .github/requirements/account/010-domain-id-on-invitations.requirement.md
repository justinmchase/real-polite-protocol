---
id: account-010
title: Sender domain_id is always included as an admin-verified claim on outgoing invitations
---

# Sender domain_id on Invitations

Every outgoing invitation envelope MUST include the sender's `domain_id` as an
admin-verified claim. This is automatic and unconditional — the caller cannot
opt out, and it does not count against the caller's `include_admin_claims`
selection.

## Motivation

Without a stable sender identifier, the receiver has no reliable basis for
abuse reporting. Display names and email addresses are user-controlled and can
be changed. The OAuth `oid` is not transmitted across domain boundaries (Section
3A). The `domain_id` is the only stable, server-controlled, per-account
identifier that safely crosses the invitation boundary without exposing internal
system identifiers.

## Expected Behavior

- When `send_invitation` builds the invitation envelope, the server MUST always
  inject `admin_verified["domain_id"] = <sender's domain_id>` into the
  `claims` object, regardless of what the caller passes in `include_admin_claims`.
- If the caller also requests other admin-verified claims via
  `include_admin_claims`, those are resolved and merged; `domain_id` is always
  present in addition to any caller-requested keys.
- If the sender's account has no `domain_id` (a legacy account — see
  `account-008`), the server MUST assign one before sending and MUST include it
  in the claim.
- The injected `domain_id` value is always taken from `admin_verified_fields`
  (the server-assigned value), never from `user_verified_fields`.
- The receiver stores the full `claims` object on the invitation record,
  including the `admin_verified.domain_id` field, making it available for
  future abuse reporting workflows.
