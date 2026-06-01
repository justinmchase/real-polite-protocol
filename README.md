# RPP — Real Polite Protocol

RPP is a lightweight, open protocol for structured, courteous machine-to-machine
communication.

This repository contains:

- **The spec** — a formal definition of the RPP protocol
- **A reference implementation** — a lightweight implementation of the spec,
  targeting [Deno Deploy](https://deno.com/deploy)

## Status

Early design phase. Spec and implementation are both under active development.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

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

| Tool                 | Description                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `list_messages`      | List messages received by the authenticated account, ordered by received_at descending.                                                    |
| `get_message`        | Retrieve a single received message by its wire message_id.                                                                                 |
| `mark_read`          | Mark one or more received messages as read.                                                                                                |
| `delete_message`     | Permanently delete a received message from the local inbox. Deletion is local-only.                                                        |
| `send_message`       | Send a `message` envelope to a contact. The local domain HMAC-signs the request with the contact's remote_credential (spec §11.3 / §11.5). |
| `list_sent_messages` | List messages dispatched by the authenticated account, ordered by sent_at descending.                                                      |

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
