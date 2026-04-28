---
id: messages-007
title: Message metadata is preserved and returned verbatim
spec_ref: "7.1.3"
---

# Message Metadata Pass-Through

The RPP server MUST preserve a sender-supplied `metadata` object from the
inbound envelope (Section 7.1.3) and return it unchanged in all read and list
responses for that message.

`metadata` is an optional sub-protocol extension point. It is not interpreted by
the core protocol.

## Expected behavior

### Storage

- When a message envelope includes a `metadata` field, the server MUST store it
  as part of the message record.
- When a message envelope omits `metadata` (or includes `null`), the stored
  record MUST NOT include a `metadata` field.

### Retrieval

- `get_message` MUST return the stored `metadata` object when present.
- `list_messages` MUST return the stored `metadata` object on each message where
  present.
- When `metadata` was not stored, neither tool MUST include the field in the
  response (it is absent, not `null` or `{}`).

### Validation

The server MUST reject a message envelope whose `metadata` value violates the
constraints of Section 7.1.3 with `E_INVALID_MESSAGE_ENVELOPE` (HTTP 400):

- Value types must be `string`, `number`, `boolean`, `null`, or a flat array of
  those types. Nested objects are NOT allowed.
- Strings (including strings inside arrays) must not exceed 512 characters.
- Arrays must not exceed 20 items.
- The object must not contain more than 20 keys.
- Key names must not exceed 64 characters.

### MCP tool send_message

- `send_message` MUST accept an optional `metadata` parameter and include it in
  the outbound envelope when provided.
- Constraint violations on the `metadata` value MUST be surfaced as a tool error
  before any outbound HTTP request is made.

## Out of scope

- The server MUST NOT interpret or act on `metadata` contents.
- Sub-protocol semantics of specific keys (e.g., `in_reply_to`) are defined by
  higher-level protocols, not by core RPP.
