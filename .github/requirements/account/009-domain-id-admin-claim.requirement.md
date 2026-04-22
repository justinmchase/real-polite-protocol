---
id: account-009
title: domain_id is an immutable claim provided by the domain
---

# domain_id as an Immutable Domain Claim

The account's `domain_id` (assigned at creation per `account-008`) MUST be
automatically stored as an **immutable claim** under the key `"domain_id"` in
the account's `immutable_fields`. The value originates from the server itself
and represents an assertion by the domain, not by any administrator or user. It
is permanently fixed once written.

## Expected Behavior

- At account creation (or on first access for legacy accounts), the server MUST
  write `immutable_fields["domain_id"] = <account.domain_id>`.
- `immutable_fields` values are write-once: once a key is stored it MUST NOT be
  overwritten by any subsequent operation.
- Because `immutable_fields` takes precedence in the merged `verified_fields`
  view (user < admin < immutable), the `domain_id` claim cannot be shadowed or
  displaced by `set_user_verified_metadata` or `set_admin_verified_metadata`.
- Attempts to overwrite `domain_id` via `set_admin_verified_metadata` MUST be
  rejected — the tool MUST return `isError: true` with a structured error.
- Attempts to remove `domain_id` via `remove_admin_verified_metadata` MUST be
  rejected — the tool MUST return `isError: true` with a structured error.
- `domain_id` appears in the effective merged `verified_fields` view and is
  therefore visible through `get_user_verified_metadata` and
  `list_verifiable_users`.

## Immutable Namespace

`domain_id` is a domain-controlled field that lives in `immutable_fields`. It is
distinct from admin-verified fields and cannot be managed via the admin metadata
tools.
