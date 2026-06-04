# RPP — Real Polite Protocol

RPP is a lightweight, open protocol for structured, courteous machine-to-machine
communication.

This repository contains:

- **The spec** — a formal definition of the RPP protocol
- **A reference implementation** — a lightweight implementation of the spec,
  targeting [Deno Deploy](https://deno.com/deploy)


## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## Spec-Driven Development

RPP is built spec-first. The protocol is defined as a written specification,
that spec is decomposed into machine-readable requirement documents, and every
requirement is verified by an executable test. Implementation code is the
*last* artifact in the chain, not the first.

This is enforced by a strict authority order that applies to every change in
the repository:

1. **RFC / spec** — [spec/rpp-spec.md](spec/rpp-spec.md)
2. **Requirement documents** — [.github/requirements/](.github/requirements/)
3. **Requirement tests** — [src/requirements/](src/requirements/)
4. **Scenarios** — [.github/scenarios/](.github/scenarios/) +
   [src/scenarios/](src/scenarios/)
5. **Implementation code** — [src/](src/)

A lower-authority artifact MUST NOT contradict a higher-authority one. When a
test fails, the implementation gets fixed — the test is not weakened. When the
desired behavior conflicts with a requirement, the requirement (and possibly
the spec) is changed deliberately and explicitly, then the tests and code
follow. This keeps the spec, the requirements, the tests, and the running code
in lock-step.

### Requirement documents

Each requirement is a small Markdown file under `.github/requirements/`,
grouped into folders by feature area (`invitations/`, `messages/`, `contacts/`,
`receptive-policy/`, `domain-admin/`, ...). Every document carries
frontmatter with a stable `id`, a human-readable `title`, and a `spec_ref`
pointing back to the relevant section(s) of the RPP spec:

```yaml
---
id: invitations-003
title: Listeners can accept a pending invitation
spec_ref: "10.2, 10.4, 11.2, 12.2"
---
```

The body describes the expected behavior in plain language — what the system
must do, what inputs it accepts, what error codes it returns, and what state
transitions it performs — at a level of detail that both humans and agents can
implement and verify against.

### Requirement tests

Every requirement document has a mirrored test file under `src/requirements/`
that uses the exact same path. For example:

| Requirement document                                                  | Test file                                                                |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `.github/requirements/startup.requirement.md`                         | `src/requirements/startup.requirement.test.ts`                           |
| `.github/requirements/invitations/003-accept-invitation.requirement.md` | `src/requirements/invitations/003-accept-invitation.requirement.test.ts` |

Each test file has a single top-level `Deno.test()` named after the
requirement id, with individual assertions grouped into `t.step()` calls:

```ts
Deno.test("req:invitations-003 - Listeners can accept a pending invitation", async (t) => {
  await t.step("creates a bilateral contact", async () => { ... });
  await t.step("dispatches an invitation_reply envelope", async () => { ... });
  await t.step("rejects non-pending invitations with E_INVITATION_NOT_PENDING", async () => { ... });
});
```

Requirement tests are integration-scoped: they exercise the real controllers,
managers, and repositories against an isolated Deno KV store. Reusable test
helpers live in [src/requirements/helpers/](src/requirements/helpers/) — test
files themselves contain only imports and `Deno.test()` calls, never inline
helpers or shared fixtures.

### Scenarios

Where requirement tests verify a single normative behavior in-process,
**scenarios** verify whole-system, multi-user journeys end-to-end through the
running MCP HTTP endpoint. Each scenario is a Markdown document under
`.github/scenarios/` describing a real-world flow in plain English (e.g.
"Alice opens a receptive window; Justin sends her an invitation; Alice
accepts and replies"), paired with a mirrored
`src/scenarios/**/<name>.scenario.test.ts` that drives the journey using
authenticated persona clients. Scenarios sit below requirement tests in the
authority chain and complement — but never replace — them.

### Coverage and gap analysis

The repository is audited continuously against its own spec. Two reports live
under [spec/reports/](spec/reports/) and are regenerated as the codebase
evolves:

- [spec/reports/gap-analysis-report.md](spec/reports/gap-analysis-report.md) —
  structural coverage: which RFC sections have requirement docs, which
  requirement docs have tests, and what is missing.
- [spec/reports/evaluate-report.md](spec/reports/evaluate-report.md) —
  semantic coverage: how thoroughly each requirement test actually verifies
  the *meaning* of its requirement document, with concrete suggestions for
  closing gaps.

Coverage is reported in the form `X/Y requirements covered by tests (Z%)`,
and significant gaps (missing requirements, weak normative language, untested
behaviors) are called out explicitly so they can be addressed before they
become regressions.

### Working with the system

When adding a new behavior, the workflow is always:

1. If the spec does not already mandate the behavior, propose a spec change
   first.
2. Add or update a requirement document under `.github/requirements/` with a
   stable `id` and a `spec_ref` back to the relevant spec section(s).
3. Add or update a mirrored requirement test under `src/requirements/` that
   fails until the behavior is implemented.
4. Implement the behavior in `src/` until the test passes.
5. Where the behavior spans multiple personas or HTTP round-trips, add a
   scenario under `.github/scenarios/` + `src/scenarios/` as well.
6. Re-run the gap-analysis and evaluate reports and address any regressions.

Run everything together with:

```sh
deno test
```

No special configuration is needed — Deno discovers all `*.test.ts` files
(requirement tests, scenario tests, and unit tests) automatically.

---

## Local Data

When you run the server locally with `deno task start`, the default Deno KV
database is stored at `.data/kv.sqlite3`.

Set `RPP_KV_PATH` to override that path when needed.

---

## Local Test Users

For manual end-to-end testing you often need a second identity besides the Azure
AD user backing your VS Code MCP session. The repo ships a dev-only auth seam
plus a small CLI for acting on the running server as a named persona.

Enable the seam (refuses to activate on Deno Deploy):

```sh
deno task dev          # same as `deno task start` with RPP_DEV_MODE=1
```

Then in another terminal, act as a persona:

```sh
deno task as alice token                     # mint and print a JWT
deno task as alice get-permissions
deno task as alice set-display-name "Alice"
deno task as alice open-window --duration 3600
deno task as alice send-invitation \
  --to localhost:8000 --shortcode <code> --terms "hello"
deno task as alice list-messages --unread
deno task as alice reply <message-id> --body "got it"
deno task as alice call <any-tool> --arg key=value
```

Persona files live in `.dev/users/<name>.json` (gitignored, auto-created on
first use). Hand-edit `roles` to add `"domain.admin"` when exercising admin-only
tools. The signing keypair lives in `.dev/keys/` and is generated on first use.
Both directories are gitignored.

Override defaults with env vars: `RPP_SERVER` (default `http://localhost:8000`),
`RPP_DEV_ISSUER` (default `urn:rpp:dev`), `RPP_DEV_PUBLIC_KEY_PATH`.

---

## MCP Tools Reference

RPP exposes its functionality as [MCP](https://modelcontextprotocol.io) tools.
The following tools are available to authenticated users via the `/mcp`
endpoint.

### Account

| Tool                         | Description                                                                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `get_permissions`            | Return current account permission levels.                                                                                                                                            |
| `get_display_name`           | Get the display name for the authenticated account.                                                                                                                                  |
| `set_display_name`           | Set or clear the display name for the authenticated account. Pass null to clear.                                                                                                     |
| `set_user_verified_metadata` | Refresh your user-sourced verified metadata record from your current token claims (name, email, preferred_username, ctry). No arguments required — the token is the source of truth. |

### Contacts

| Tool                | Description                                                                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `list_contacts`     | List contacts owned by the authenticated account. Returns the bilateral contact records established via accepted invitations (spec §11). Supports filtering by blocked status. |
| `get_contact`       | Retrieve a single contact by id. Returns 404 when not owned by the caller.                                                                                                     |
| `set_contact_field` | Record an owner-supplied field value for a contact. The new record is appended as source `owner_note`; existing values from other sources are preserved.                       |
| `remove_contact_field_revision` | Permanently remove a single historical revision from a contact's field history, identified by `(contact_id, key, recorded_at)`. Works on any revision, not just the most recent (spec §11.7).            |
| `block_contact`     | Mark a contact as blocked. Inbound and outbound messaging through this contact is refused until the contact is unblocked (spec §11.6).                                         |
| `unblock_contact`   | Clear the blocked flag on a contact, restoring inbound and outbound messaging.                                                                                                 |
| `delete_contact`    | Permanently delete a contact and its history. Both directions of communication become unsignable; pending invitations are unaffected.                                          |

### Invitations

| Tool                    | Description                                                                                                                                                                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list_invitations`      | List inbound invitations addressed to the authenticated account. Filter by status or remote domain.                                                                                                                                |
| `list_sent_invitations` | List outbound invitations sent by the authenticated account.                                                                                                                                                                       |
| `review_invitation`     | Get detailed information about a specific invitation before accepting or rejecting.                                                                                                                                                |
| `accept_invitation`     | Accept an inbound invitation. Creates a bilateral contact, generates a fresh local credential, and dispatches an `invitation_reply` envelope to the remote (spec §10.4 / §11.2 path 1).                                            |
| `reject_invitation`     | Reject an inbound invitation. The rejection is recorded locally; no envelope is sent to the remote.                                                                                                                                |
| `send_invitation`       | Send an invitation envelope to a remote RPP domain (spec §10.1). Provide exactly one of `receptive_policy_id` or `shortcode`. The local domain generates a fresh reply_credential the remote will use to authenticate their reply. |
| `cancel_invitation`     | Cancel a pending outbound invitation (spec §10.3). Re-sends the invitation envelope with `cancelled: true` to the remote, then transitions the local outbound record to cancelled.                                                 |
| `invite_contact`        | Re-invite a known contact using a fresh `receptive_policy_id` shared out-of-band (spec §11.3 / contacts-006). Convenience wrapper around `send_invitation` that resolves `receiver_domain` from the stored contact.                |

### Messages

| Tool                 | Description                                                                                                                                                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list_messages`      | Pure-query: list messages received by the authenticated account, ordered by received_at descending. Does NOT mark messages as read. Use for unread counts, filtering, or pagination without consuming.                 |
| `read_messages`      | Fetch messages for presentation to the user AND mark them all as read. Accepts the same filters as `list_messages`. Call this when displaying message content.                                                         |
| `get_message`        | Retrieve a single received message by its wire message_id. Does NOT mark the message as read.                                                                                                                          |
| `read_message`       | Retrieve a single received message by its wire message_id AND mark it as read. Use when presenting the message body to the user.                                                                                       |
| `mark_read`          | Mark one or more received messages as read.                                                                                                                                                                            |
| `delete_message`     | Permanently delete a received message from the local inbox. Deletion is local-only.                                                                                                                                    |
| `send_message`       | Send a `message` envelope to a contact. The local domain HMAC-signs the request with the contact's remote_credential (spec §11.3 / §11.5).                                                                             |
| `list_sent_messages` | List messages dispatched by the authenticated account, ordered by sent_at descending.                                                                                                                                  |

### Receptive Policies

| Tool                      | Description                                                                                                                                                                                                                                                           |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_receptive_policies`  | List all receptive policies for the authenticated user. Returns an empty list if no policies have been added (implying closed/not receptive).                                                                                                                         |
| `add_receptive_policy`    | Add a new receptive policy. Policies stack — multiple can be active simultaneously. Supports modes: `all`, `domain_filter`, `contact`, or `closed`.                                                                                                                   |
| `open_receptive_window`   | Open a time-bounded receptive window that stacks with existing policies. Returns a shortcode (8 lowercase alphanumeric characters) tied to this window. The user must share both the shortcode and the server domain with the person who wants to send an invitation. |
| `remove_receptive_policy` | Remove a receptive policy. For time-bounded windows this closes the window early.                                                                                                                                                                                     |

### Domain Admin

> These tools are only available to users with the domain admin role.

| Tool                             | Description                                                                                           |
| -------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `get_domain_identity`            | Retrieve the current domain identity as published by the server.                                      |
| `update_domain_identity`         | Update mutable domain identity fields.                                                                |
| `get_contact_policy_url`         | Retrieve the current `contact_policy_url` from domain identity.                                       |
| `set_contact_policy_url`         | Set or update the `contact_policy_url`.                                                               |
| `get_verification_key`           | Retrieve the active public verification key and key identifier.                                       |
| `rotate_verification_key`        | Generate a new Ed25519 keypair for domain-verified invitations. Archives the previous active key.     |
| `list_historical_keys`           | List archived verification keys with key_id and archived_at metadata.                                 |
| `delete_historical_key`          | Remove an archived verification key by key_id. Prior attestations using that key become unverifiable. |
| `list_verifiable_users`          | List users whose metadata the server can verify, along with their verifiable fields.                  |
| `get_user_verified_metadata`     | Retrieve verified metadata for a specific user by oid.                                                |
| `set_admin_verified_metadata`    | Create or update admin-supplied verified metadata fields for a specific registered user.              |
| `remove_admin_verified_metadata` | Remove one admin-verified metadata field for a specific registered user.                              |
