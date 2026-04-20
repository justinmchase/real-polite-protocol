---
id: account-002
title: Account is auto-provisioned on first authenticated MCP request
---

# Account Provisioning

When a listener authenticates to the MCP endpoint for the first time, the server
MUST automatically create an Account for them. Subsequent requests from the same
principal MUST resolve to the same existing Account without creating duplicates.

## Expected behavior

- On every authenticated MCP request, the server resolves the `oid` claim from
  the validated bearer token to an Account.
- If no Account exists for that `oid`, one is created automatically (upsert
  semantics — no explicit sign-up step required).
- The Account `oid` field stores the value of the token's `oid` claim and is
  used as the lookup key.
- The provisioning is transparent to the caller — the MCP tool response is the
  same whether the account was just created or already existed.
- Account creation MUST NOT fail a valid authenticated request.
- When an Account is first created, the server MUST automatically seed the
  user's verified metadata record from the identity claims present in the
  validated bearer token (e.g. `name`, `email`, `preferred_username`). Only
  non-empty claims are stored; absent claims are omitted.
- Seeding is a one-time operation at Account creation; subsequent requests do
  not overwrite the verified metadata record.
