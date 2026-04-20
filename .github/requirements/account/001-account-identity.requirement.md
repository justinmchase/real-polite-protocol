---
id: account-001
title: Account is the server-local identity for an authenticated listener
---

# Account Identity

An **Account** is the server-local representation of an authenticated listener.
Accounts are local to the RPP server and are never transmitted across domain
boundaries (Section 3A.1). The only protocol-level identity that crosses domains
is the domain name itself.

## Expected behavior

- Each unique authenticated principal (identified by the `oid` claim in the
  bearer token) maps to exactly one Account on this server.
- The Account `id` is stable and does not change across sessions.
- Accounts are not publicly addressable — they have no protocol-level identifier
  visible outside the server.
- The server MUST NOT require a display name as a condition of having an account
  (Section 3A.2).
