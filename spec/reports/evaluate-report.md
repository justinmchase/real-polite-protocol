# Semantic Closure Evaluation Report

**Scope**: all  
**Methodology**: Statement-level semantic scoring — 1.0 covered · 0.5 partial · 0.0 uncovered  
**How to use this report**: Each unchecked box in § Action Items represents one
missing or weak test step. Work top-to-bottom; mark `[x]` when the
corresponding test step has been added and is passing.

---

## Overall

| Metric | Score |
|--------|-------|
| Requirements fully covered (≥ 0.80) | 45 / 78 (57.7%) |
| Requirements partially covered (0.40–0.79) | 23 / 78 (29.5%) |
| Requirements with no covered steps (< 0.40) | 10 / 78 (12.8%) |
| **Statement-weighted coverage** | **486 / 609 = 79.8%** |

---

## By Category

| Category | Reqs | Stmts | Stmt-wt% | Covered ≥0.80 | Partial 0.40–0.79 | Uncovered |
|----------|------|-------|----------|---------------|-------------------|-----------|
| root-level | 3 | 14 | 85.7% | 2 | 1 | 0 |
| account | 10 | 53 | 86.8% | 9 | 1 | 0 |
| contacts | 7 | 35 | 82.9% | 6 | 1 | 0 |
| deployment | 1 | 3 | 66.7% | 0 | 1 | 0 |
| domain-admin | 13 | 29 | 72.4% | 6 | 6 | 1 |
| invitations | 9 | 62 | 80.6% | 7 | 2 | 0 |
| mcp | 2 | 16 | 81.3% | 1 | 1 | 0 |
| mcp/auth | 12 | 47 | 85.1% | 10 | 2 | 0 |
| messages | 6 | 53 | 81.1% | 5 | 1 | 0 |
| receipts | 4 | 26 | 84.6% | 3 | 1 | 0 |
| receptive-policy | 7 | 61 | 75.4% | 4 | 3 | 0 |
| submit | 4 | 209 | 74.6% | 2 | 2 | 0 |

---

## By Requirement

| ID | Title | Score | Stmts (✓ / ⚠ / ✗) | Notes |
|----|-------|-------|-------------------|-------|
| startup-001 | Application starts without error | 1.00 | 2 / 0 / 0 | fully covered |
| config-001 | Default local KV path is configurable | 1.00 | 4 / 0 / 0 | fully covered |
| well-known-001 | Domain identity well-known endpoint | 0.70 | 3 / 2 / 0 | 2 statements need additional coverage |
| account-001 | Account is the server-local identity for an authenticated listener | 1.00 | 4 / 0 / 0 | fully covered |
| account-002 | Account is auto-provisioned on first authenticated MCP request | 1.00 | 8 / 0 / 0 | fully covered |
| account-003 | Account MAY have an optional display name | 1.00 | 2 / 0 / 0 | fully covered |
| account-004 | All MCP tool operations are scoped to the authenticated account | 1.00 | 5 / 0 / 0 | fully covered |
| account-005 | Domain tools require domain.admin role from token roles claim | 1.00 | 6 / 0 / 0 | fully covered |
| account-006 | MCP exposes permission introspection tool for current account | 1.00 | 4 / 0 / 0 | fully covered |
| account-007 | Users can refresh their own verified metadata from their token | 1.00 | 8 / 0 / 0 | fully covered |
| account-008 | Accounts are assigned an immutable domain_id at creation | 1.00 | 4 / 0 / 0 | fully covered |
| account-009 | domain_id is an immutable claim provided by the domain | 1.00 | 6 / 0 / 0 | fully covered |
| account-010 | Sender domain_id is always included as an admin-verified claim on outgoing invitations | 1.00 | 3 / 0 / 0 | fully covered |
| contacts-001 | Contact auto-creation on invitation acceptance | 0.80 | 5 / 0 / 1 | 1 statement needs test coverage |
| contacts-002 | Contact field accumulation from invitation claims | 0.80 | 5 / 0 / 1 | 1 statement needs test coverage |
| contacts-003 | list_contacts tool | 1.00 | 3 / 0 / 0 | fully covered |
| contacts-004 | get_contact tool | 1.00 | 3 / 0 / 0 | fully covered |
| contacts-005 | delete_contact tool | 1.00 | 5 / 0 / 0 | fully covered |
| contacts-006 | invite_contact tool | 1.00 | 5 / 0 / 0 | fully covered |
| contacts-007 | Owner-authored custom field on a contact | 1.00 | 4 / 0 / 0 | fully covered |
| deployment-001 | Single-Tenant-Per-Instance Deployment | 0.67 | 1 / 2 / 0 | 2 statements need additional coverage |
| domain-admin-001 | Domain administrators can retrieve domain identity | 1.00 | 2 / 0 / 0 | fully covered |
| domain-admin-002 | Domain administrators can update domain identity fields | 1.00 | 3 / 0 / 0 | fully covered |
| domain-admin-003 | Domain administrators can retrieve the active verification key | 1.00 | 3 / 0 / 0 | fully covered |
| domain-admin-004 | Domain administrators can rotate the invitation verification key | 1.00 | 2 / 0 / 0 | fully covered |
| domain-admin-005 | Domain administrators can list archived verification keys | 1.00 | 2 / 0 / 0 | fully covered |
| domain-admin-006 | Domain administrators can delete archived verification keys | 0.50 | 0 / 1 / 1 | 2 statements need test coverage |
| domain-admin-007 | Domain administrators can list verifiable users | 1.00 | 3 / 0 / 0 | fully covered |
| domain-admin-008 | Domain administrators can retrieve a user's verified metadata | 1.00 | 3 / 0 / 0 | fully covered |
| domain-admin-009 | Domain administrators can set admin verified metadata | 1.00 | 3 / 0 / 0 | fully covered |
| domain-admin-010 | Domain administrators can remove admin verified metadata | 0.50 | 1 / 1 / 1 | 2 statements need additional coverage |
| domain-admin-011 | Domain administrators can retrieve contact policy URL | 1.00 | 2 / 0 / 0 | fully covered |
| domain-admin-012 | Domain administrators can set contact policy URL | 1.00 | 3 / 0 / 0 | fully covered |
| domain-admin-013 | Domain identity includes port when non-standard | 0.75 | 2 / 2 / 0 | 2 statements need additional coverage |
| invitations-001 | Listeners can list their invitations | 1.00 | 4 / 0 / 0 | fully covered |
| invitations-002 | Listeners can review a pending invitation | 1.00 | 4 / 0 / 0 | fully covered |
| invitations-003 | Listeners can accept a pending invitation | 0.75 | 5 / 2 / 0 | 2 statements need additional coverage |
| invitations-004 | Listeners can reject a pending invitation | 1.00 | 4 / 0 / 0 | fully covered |
| invitations-005 | Listeners can send invitations via a receptive policy ID or a receipt ID | 1.00 | 6 / 0 / 0 | fully covered |
| invitations-006 | Senders can attach verified and custom claims to outgoing invitations | 0.80 | 5 / 0 / 1 | 1 statement needs test coverage |
| invitations-007 | Receivers deliver an acceptance or rejection callback to the inviting domain | 1.00 | 6 / 0 / 0 | fully covered |
| invitations-008 | Inviting domains process inbound receipt callbacks to finalize invitations | 1.00 | 6 / 0 / 0 | fully covered |
| invitations-009 | Senders can cancel a direct invitation they have sent | 1.00 | 5 / 0 / 0 | fully covered |
| mcp-001 | Tools use structured output with outputSchema | 0.80 | 4 / 0 / 1 | 1 statement needs test coverage |
| mcp-002 | MCP server lists all registered tools via tools/list | 1.00 | 6 / 0 / 0 | fully covered |
| mcp-auth-001 | Server exposes MCP endpoint for listener workflows | 1.00 | 3 / 0 / 0 | fully covered |
| mcp-auth-002 | MCP endpoint requires bearer token authentication | 1.00 | 3 / 0 / 0 | fully covered |
| mcp-auth-003 | Bearer token is supplied only in Authorization header | 1.00 | 4 / 0 / 0 | fully covered |
| mcp-auth-004 | Access token validation enforces audience and token validity | 1.00 | 5 / 0 / 0 | fully covered |
| mcp-auth-005 | Client bearer tokens are never forwarded upstream | 1.00 | 3 / 0 / 0 | fully covered |
| mcp-auth-006 | OAuth discovery metadata is published for MCP authentication | 1.00 | 3 / 0 / 0 | fully covered |
| mcp-auth-007 | Unauthorized responses include OAuth challenge metadata | 1.00 | 2 / 0 / 0 | fully covered |
| mcp-auth-008 | MCP endpoint validates Origin header | 0.50 | 0 / 2 / 0 | 2 statements need test coverage |
| mcp-auth-009 | MCP and OAuth endpoints are served over HTTPS | 1.00 | 3 / 0 / 0 | fully covered |
| mcp-auth-010 | MCP authentication failures use standardized HTTP status codes | 1.00 | 4 / 0 / 0 | fully covered |
| mcp-auth-011 | OAuth authorization flow uses canonical resource indicator | 1.00 | 3 / 0 / 0 | fully covered |
| mcp-auth-012 | Azure AD/Entra ID Token v2.0 Compatibility | 1.00 | 4 / 0 / 0 | fully covered |
| messages-001 | Listeners can send messages using a held receipt | 0.75 | 6 / 0 / 2 | 2 statements need test coverage |
| messages-002 | Listeners can list messages in their inbox | 1.00 | 8 / 0 / 0 | fully covered |
| messages-003 | Listeners can retrieve a single message by ID | 1.00 | 5 / 0 / 0 | fully covered |
| messages-004 | Listeners can mark messages as read | 1.00 | 6 / 0 / 0 | fully covered |
| messages-005 | Listeners can delete a message from their local store | 1.00 | 6 / 0 / 0 | fully covered |
| messages-006 | Message responses include all recorded claims from the sender | 1.00 | 6 / 0 / 0 | fully covered |
| receipts-001 | Accepting an invitation issues and records a receipt | 1.00 | 5 / 0 / 0 | fully covered |
| receipts-002 | Listeners can list receipts they have issued | 1.00 | 5 / 0 / 0 | fully covered |
| receipts-003 | Listeners can revoke an issued receipt | 1.00 | 5 / 0 / 0 | fully covered |
| receipts-004 | Receipt superseding on new acceptance | 1.00 | 6 / 0 / 0 | fully covered |
| receptive-policy-001 | Listeners can list their receptive policies | 1.00 | 4 / 0 / 0 | fully covered |
| receptive-policy-002 | Listeners can add a receptive policy | 1.00 | 5 / 0 / 0 | fully covered |
| receptive-policy-003 | Listeners can open a time-bounded receptive window | 1.00 | 5 / 0 / 0 | fully covered |
| receptive-policy-004 | Contact-based receptive policy | 0.57 | 3 / 2 / 2 | 4 statements need test coverage |
| receptive-policy-005 | Receipt-based receptive policy (auto-creation and re-invitation) | 1.00 | 5 / 0 / 0 | fully covered |
| receptive-policy-006 | Listeners can remove a receptive policy | 1.00 | 5 / 0 / 0 | fully covered |
| receptive-policy-007 | Receptive windows expose a shareable shortcode | 0.70 | 5 / 2 / 2 | 4 statements need test coverage |
| submit-001 | Servers expose an envelope endpoint | 0.67 | 4 / 1 / 2 | 3 statements need test coverage |
| submit-002 | Envelope requests are authenticated with HMAC signatures | 0.80 | 8 / 0 / 2 | 2 statements need test coverage |
| submit-003 | Envelope requests are protected against replay | 0.75 | 6 / 0 / 2 | 2 statements need test coverage |
| submit-004 | Envelope requests are validated against schema | 0.60 | 10 / 0 / 7 | 7 statements need test coverage |

---

## Action Items

> Work this list top-to-bottom. Add the described `t.step` to the indicated file, run the test, then mark `[x]`.

### submit-004 — Envelope requests are validated against the kind-specific schema before acceptance

File: [src/requirements/submit/004-submit-envelope-validation.requirement.test.ts](src/requirements/submit/004-submit-envelope-validation.requirement.test.ts)  
Score: 0.60 · Statements: 10 ✓ / 0 ⚠ / 7 ✗

- [x] **Statement** (✗ uncovered): "The request body is valid JSON; otherwise the server rejects it with `E_INVALID_REQUEST_BODY`."
      **Add step**: `await t.step("rejects invalid JSON request body with E_INVALID_REQUEST_BODY", ...)`
      **Assert**: POST with non-JSON body returns HTTP 400 with `error.code === "E_INVALID_REQUEST_BODY"`.
      **Spec ref**: submit-004 bullet 1

- [x] **Statement** (✗ uncovered): "The total request body size does not exceed 256 KB; oversized requests are rejected with `E_MESSAGE_TOO_LARGE`."
      **Add step**: `await t.step("rejects oversized request body exceeding 256 KB with E_MESSAGE_TOO_LARGE", ...)`
      **Assert**: POST with 300 KB body returns HTTP 400/413 with `error.code === "E_MESSAGE_TOO_LARGE"`.
      **Spec ref**: submit-004 bullet 2

- [x] **Statement** (✗ uncovered): "`content_type` MUST be one of `text/markdown` or `application/json`. Any other value is rejected with `E_INVALID_CONTENT_TYPE`."
      **Add step**: `await t.step("rejects unsupported content_type with E_INVALID_CONTENT_TYPE", ...)`
      **Assert**: Message envelope with `content_type: "text/html"` returns HTTP 400 with `error.code === "E_INVALID_CONTENT_TYPE"`.
      **Spec ref**: submit-004 Message envelope section

- [x] **Statement** (✗ uncovered): "Servers MUST validate JSON syntactic well-formedness for `application/json` bodies and reject malformed JSON with `E_INVALID_BODY`."
      **Add step**: `await t.step("rejects malformed JSON in application/json body with E_INVALID_BODY", ...)`
      **Assert**: Message envelope with `content_type: "application/json"` and `content: "not json"` returns HTTP 400 with `error.code === "E_INVALID_BODY"`.
      **Spec ref**: submit-004 Message envelope section

- [x] **Statement** (✗ uncovered): "The envelope includes an `invitation` object with at minimum `invitation_id`, `proposed_terms`, and a `delivery` block."
      **Add step**: `await t.step("rejects invitation envelope missing required invitation fields", ...)`
      **Assert**: Invitation envelope with `invitation` lacking `proposed_terms` returns HTTP 400 with schema validation error.
      **Spec ref**: submit-004 Invitation envelope section

- [x] **Statement** (✗ uncovered): "Exactly one of `receptive_policy_id`, `shortcode`, or `receipt_id` MUST be present on the invitation; both or neither is invalid."
      **Add step**: `await t.step("rejects invitation envelope with neither receptive_policy_id nor receipt_id nor shortcode", ...)`
      **Assert**: Invitation envelope with none of the three addressing fields returns HTTP 400.
      **Spec ref**: submit-004 Invitation envelope section

- [x] **Statement** (✗ uncovered): "The envelope MUST include `category: \"receipt\"`, `invitation_id`, and `decision` (`\"accepted\"` or `\"rejected\"`)."
      **Add step**: `await t.step("rejects receipt envelope missing required fields", ...)`
      **Assert**: Receipt callback envelope without `decision` field returns HTTP 400.
      **Spec ref**: submit-004 Receipt envelope section

---

### receptive-policy-007 — Receptive windows expose a shareable shortcode

File: [src/requirements/receptive-policy/007-receptive-window-shortcode.requirement.test.ts](src/requirements/receptive-policy/007-receptive-window-shortcode.requirement.test.ts)  
Score: 0.70 · Statements: 5 ✓ / 2 ⚠ / 2 ✗

- [ ] **Statement** (✗ uncovered): "When a receptive policy is deleted, the shortcode index entry MUST also be removed."
      **Add step**: `await t.step("shortcode index entry is removed when policy is deleted via remove_receptive_policy", ...)`
      **Assert**: After `remove_receptive_policy`, sending an invitation using the old shortcode returns `E_RECEPTIVE_POLICY_NOT_FOUND`.
      **Spec ref**: receptive-policy-007 Lifecycle section

- [ ] **Statement** (✗ uncovered): "The shortcode index entry MUST be written atomically with the policy record."
      **Add step**: `await t.step("shortcode and policy record are always consistent (no half-written state)", ...)`
      **Assert**: Any policy retrievable by ID also has a resolvable shortcode; any shortcode that resolves returns a valid policy.
      **Spec ref**: receptive-policy-007 Lifecycle section

- [ ] **Statement** (⚠ partial — uniqueness retry logic not tested): "If the generated shortcode collides with an existing one, the server MUST retry generation up to 10 times before failing."
      **Add step**: `await t.step("open_receptive_window succeeds even when first shortcode candidate collides", ...)`
      **Assert**: Seed 10 policies with known shortcodes that exhaust the retry space; 11th call returns error; or: confirm the implementation retries by inspecting that two concurrent policies have distinct shortcodes.
      **Spec ref**: receptive-policy-007 Uniqueness section

- [ ] **Statement** (⚠ partial — tool response includes shortcode but copyable presentation not verified): "The tool response MUST include both `shortcode` and `domain` so the caller can share it."
      **Add step**: `await t.step("open_receptive_window response includes both shortcode and domain fields", ...)`
      **Assert**: Tool result object has `shortcode` (8 chars `[a-z0-9]`) and `domain` (non-empty string) fields.
      **Spec ref**: receptive-policy-007 Sharing section

---

### receptive-policy-004 — Contact-based receptive policy

File: [src/requirements/receptive-policy/004-contact-receptive-policy.requirement.test.ts](src/requirements/receptive-policy/004-contact-receptive-policy.requirement.test.ts)  
Score: 0.57 · Statements: 3 ✓ / 2 ⚠ / 2 ✗

- [ ] **Statement** (✗ uncovered): "To add or remove an entry, the caller MUST delete the policy and create a new one with the revised list."
      **Add step**: `await t.step("contact policy list is immutable; requires delete-and-recreate to modify", ...)`
      **Assert**: No `update_receptive_policy` tool exists; updating requires remove + add cycle; confirm `add_receptive_policy` rejects duplicate (domain, domain_id) pairs on an existing policy.
      **Spec ref**: receptive-policy-004 rule 8

- [ ] **Statement** (✗ uncovered): "Two different domains that issue the same UUID are different contacts."
      **Add step**: `await t.step("contact policy distinguishes contacts from different domains even with same domain_id", ...)`
      **Assert**: Policy listing (domainA, uuid-X) rejects invitation from (domainB, uuid-X).
      **Spec ref**: receptive-policy-004 rule 5

- [ ] **Statement** (⚠ partial — happy path tested but case-insensitive domain comparison not explicitly tested): "Domain matching is case-insensitive."
      **Add step**: `await t.step("contact policy domain matching is case-insensitive", ...)`
      **Assert**: Policy listing `SENDER.EXAMPLE` accepts invitation where `sender_domain === "sender.example"`.
      **Spec ref**: receptive-policy-004 rule 4

- [ ] **Statement** (⚠ partial — one sender tested but exact domain_id match not explicitly isolated): "The `domain_id` matching is exact."
      **Add step**: `await t.step("contact policy requires exact domain_id match", ...)`
      **Assert**: Policy listing sender's `domain_id` rejects invitation where only the `domain_id` differs by one character.
      **Spec ref**: receptive-policy-004 rule 4

---

### submit-003 — Envelope requests are protected against replay

File: [src/requirements/submit/003-submit-replay-protection.requirement.test.ts](src/requirements/submit/003-submit-replay-protection.requirement.test.ts)  
Score: 0.75 · Statements: 6 ✓ / 0 ⚠ / 2 ✗

- [ ] **Statement** (✗ uncovered): "A duplicate `receipt` callback for the same `invitation_id` is rejected with `E_INVITATION_NOT_PENDING` (the first callback transitions the invitation out of `pending` and consumes the delivery token)."
      **Add step**: `await t.step("rejects duplicate receipt callback with E_INVITATION_NOT_PENDING", ...)`
      **Assert**: Second POST with same `invitation_id` receipt callback returns `error.code === "E_INVITATION_NOT_PENDING"`.
      **Spec ref**: submit-003 deduplication section

- [ ] **Statement** (✗ uncovered): "The deduplication cache retains entries for at least 60 seconds."
      **Add step**: `await t.step("deduplication cache retains replay rejection for at least 60 seconds", ...)`
      **Assert**: Duplicate envelope submitted 55 seconds after original is still rejected; confirm the implementation sets a TTL ≥ 60s.
      **Spec ref**: submit-003 last bullet

---

### submit-002 — Envelope requests are authenticated with HMAC signatures keyed by envelope kind

File: [src/requirements/submit/002-submit-hmac-auth.requirement.test.ts](src/requirements/submit/002-submit-hmac-auth.requirement.test.ts)  
Score: 0.80 · Statements: 8 ✓ / 0 ⚠ / 2 ✗

- [ ] **Statement** (✗ uncovered): "The server rejects requests that present multiple identity headers, or an identity header that does not match the envelope `category`, with `E_INVALID_AUTH_HEADERS`."
      **Add step**: `await t.step("rejects envelope with mismatched identity header and category with E_INVALID_AUTH_HEADERS", ...)`
      **Assert**: Message envelope sent with `x-rpp-invitation-id` header (wrong kind) returns HTTP 403 with `error.code === "E_INVALID_AUTH_HEADERS"`.
      **Spec ref**: submit-002 bullet 6

- [ ] **Statement** (✗ uncovered): "Credential-based authorization failures use HTTP 403, not HTTP 401."
      **Add step**: `await t.step("invalid HMAC signature returns HTTP 403 not 401", ...)`
      **Assert**: Request with correct headers but wrong signature returns status 403.
      **Spec ref**: submit-002 last bullet

---

### submit-001 — Servers expose an envelope endpoint

File: [src/requirements/submit/001-submit-endpoint.requirement.test.ts](src/requirements/submit/001-submit-endpoint.requirement.test.ts)  
Score: 0.67 · Statements: 4 ✓ / 1 ⚠ / 2 ✗

- [ ] **Statement** (✗ uncovered): "Invitation envelope response shape: `{ ok, accepted, invitation_id }`. If the receiver auto-accepts, MAY additionally include the issued `receipt` inline."
      **Add step**: `await t.step("invitation envelope returns correct response schema including optional inline receipt", ...)`
      **Assert**: Successful invitation POST returns body with `ok: true`, `accepted: boolean`, `invitation_id: string`; when auto-accepted, `receipt` object also present.
      **Spec ref**: submit-001 Response shapes section

- [ ] **Statement** (✗ uncovered): "Receipt callback envelope response shape: `{ ok, accepted, invitation_id }`."
      **Add step**: `await t.step("receipt callback envelope returns correct response schema", ...)`
      **Assert**: Successful receipt callback POST returns body with `ok: true`, `accepted: boolean`, `invitation_id: string`.
      **Spec ref**: submit-001 Response shapes section

- [ ] **Statement** (⚠ partial — endpoint tested via helper but explicit path assertion not present): "The server exposes a POST endpoint at `/rpp/v1/envelopes`."
      **Add step**: `await t.step("envelope endpoint is accessible at /rpp/v1/envelopes", ...)`
      **Assert**: `fetch(baseUrl + "/rpp/v1/envelopes", { method: "POST", ... })` reaches the handler (no 404).
      **Spec ref**: submit-001 first bullet

---

### messages-001 — Listeners can send messages using a held receipt

File: [src/requirements/messages/001-send-message.requirement.test.ts](src/requirements/messages/001-send-message.requirement.test.ts)  
Score: 0.75 · Statements: 6 ✓ / 0 ⚠ / 2 ✗

- [ ] **Statement** (✗ uncovered): "The server MUST generate a UUIDv7 `message_id` and ensure `(sender_domain, message_id)` is unique per the local sender domain."
      **Add step**: `await t.step("send_message generates a UUIDv7 message_id unique per sender_domain", ...)`
      **Assert**: Returned `message_id` passes UUIDv7 format check (version nibble = 7); a second `send_message` call returns a different `message_id`.
      **Spec ref**: messages-001 bullet 11

- [ ] **Statement** (✗ uncovered): "If the message body exceeds 256 KB, the tool MUST reject the call locally with `E_MESSAGE_TOO_LARGE`."
      **Add step**: `await t.step("send_message rejects body content exceeding 256 KB with E_MESSAGE_TOO_LARGE", ...)`
      **Assert**: `body.content` set to `"x".repeat(300 * 1024)` yields `error.code === "E_MESSAGE_TOO_LARGE"`.
      **Spec ref**: messages-001 last bullet

---

### mcp-001 — Tools use structured output with outputSchema

File: [src/requirements/mcp/001-tool-output-format.requirement.test.ts](src/requirements/mcp/001-tool-output-format.requirement.test.ts)  
Score: 0.80 · Statements: 4 / 0 / 1

- [ ] **Statement** (✗ uncovered): "Tool handlers SHOULD use the shared `toolResult()` helper from `src/tools/tool-result.ts` to produce both `structuredContent` and the text fallback from a single data object."
      **Add step**: `await t.step("all tool handlers invoke the toolResult() helper for output formatting", ...)`
      **Assert**: `grep -r "toolResult(" src/tools/` finds at least one call per tool file; or a static analysis step confirms no tool returns raw objects without `toolResult()`.
      **Spec ref**: mcp-001 Rationale section

---

### invitations-006 — Senders can attach verified and custom claims to outgoing invitations

File: [src/requirements/invitations/006-send-invitation-claims.requirement.test.ts](src/requirements/invitations/006-send-invitation-claims.requirement.test.ts)  
Score: 0.80 · Statements: 5 ✓ / 0 ⚠ / 1 ✗

- [ ] **Statement** (✗ uncovered): "If none of the inputs yield any claim data, the `claims` field is absent or an empty object in the envelope."
      **Add step**: `await t.step("invite_contact succeeds when no claims data is available from any source", ...)`
      **Assert**: `invite_contact` called with no `custom_claims` and an account with no `user_verified_fields` produces a valid invitation; envelope sent to receiver has absent or empty `claims`.
      **Spec ref**: invitations-006 Expected Behavior, last bullet

---

### contacts-002 — Contact field accumulation from invitation claims

File: [src/requirements/contacts/002-contact-field-accumulation.requirement.test.ts](src/requirements/contacts/002-contact-field-accumulation.requirement.test.ts)  
Score: 0.80 · Statements: 5 ✓ / 0 ⚠ / 1 ✗

- [ ] **Statement** (✗ uncovered): "`get_contact` MUST return the full `fields` history (all `ContactFieldRecord` entries per key, not just the most recent)."
      **Add step**: `await t.step("get_contact returns full field history array for each key", ...)`
      **Assert**: After two invitations from the same sender with different values for the same claim key, `get_contact` response `fields[key]` is an array with 2 entries.
      **Spec ref**: contacts-002 rule 5

---

### contacts-001 — Contact auto-creation on invitation acceptance

File: [src/requirements/contacts/001-contact-auto-creation.requirement.test.ts](src/requirements/contacts/001-contact-auto-creation.requirement.test.ts)  
Score: 0.80 · Statements: 5 ✓ / 0 ⚠ / 1 ✗

- [ ] **Statement** (✗ uncovered): "If the invitation has no `claims.immutable.domain_id`, no contact is created."
      **Add step**: `await t.step("accepting invitation without domain_id does not create a contact", ...)`
      **Assert**: Accept invitation seeded without `claims.immutable.domain_id`; `list_contacts` returns empty array.
      **Spec ref**: contacts-001 rule 7

---

### mcp-auth-008 — MCP endpoint validates Origin header

File: [src/requirements/mcp/auth/008-origin-validation.requirement.test.ts](src/requirements/mcp/auth/008-origin-validation.requirement.test.ts)  
Score: 0.50 · Statements: 0 ✓ / 2 ⚠ / 0 ✗

- [ ] **Statement** (⚠ partial — needs explicit rejection test): "Requests with disallowed or malformed origins MUST be rejected."
      **Add step**: `await t.step("rejects MCP request with disallowed Origin header", ...)`
      **Assert**: POST to MCP endpoint with `Origin: https://evil.example` returns HTTP 403 (or 400).
      **Spec ref**: mcp-auth-008 Expected behavior bullet 1

- [ ] **Statement** (⚠ partial — needs explicit test for ordering): "Origin validation is enforced before sensitive MCP operations execute."
      **Add step**: `await t.step("Origin is validated before any tool handler executes", ...)`
      **Assert**: Request with disallowed Origin + valid bearer token returns 403 without executing the tool (tool-side KV state unchanged).
      **Spec ref**: mcp-auth-008 Expected behavior bullet 3

---

### domain-admin-013 — Domain identity includes port when non-standard

File: [src/requirements/domain-admin/013-domain-identity-port.requirement.test.ts](src/requirements/domain-admin/013-domain-identity-port.requirement.test.ts)  
Score: 0.75 · Statements: 2 ✓ / 2 ⚠ / 0 ✗

- [ ] **Statement** (⚠ partial — port present in test output but exact `:PORT` suffix assertion may be missing): "A server started on `localhost:8000` exposes a domain identity of `localhost:8000`."
      **Add step**: `await t.step("domain identity equals localhost:PORT for non-standard port", ...)`
      **Assert**: `assertEquals(domainIdentity.domain, \`localhost:${port}\`)` where `port !== 443`.
      **Spec ref**: domain-admin-013 Expected behavior, rule 1

- [ ] **Statement** (⚠ partial — standard-port exclusion case not covered): "A server on port 443 exposes a domain identity of `example.com` (no port suffix)."
      **Add step**: `await t.step("domain identity omits port suffix when port is 443", ...)`
      **Assert**: With `RPP_DOMAIN=example.com` and port 443 configured, domain identity is `"example.com"` (no `:443`).
      **Spec ref**: domain-admin-013 Expected behavior, rule 2

---

### domain-admin-010 — Domain administrators can remove admin verified metadata

File: [src/requirements/domain-admin/010-remove-admin-verified-metadata.requirement.test.ts](src/requirements/domain-admin/010-remove-admin-verified-metadata.requirement.test.ts)  
Score: 0.50 · Statements: 1 ✓ / 1 ⚠ / 1 ✗

- [ ] **Statement** (✗ uncovered): "The system reconciles invitation verification state after field removal (subsequent invitations no longer carry the removed field)."
      **Add step**: `await t.step("subsequent invitation after field removal does not carry the removed admin-verified field", ...)`
      **Assert**: After `remove_admin_verified_metadata`, `invite_contact` produces an envelope whose `claims.admin` does not include the removed key.
      **Spec ref**: domain-admin-010 Expected behavior bullet 3

- [ ] **Statement** (⚠ partial — removal tested but merged view recalculation not explicitly verified): "After removal, the effective view returned by `get_user_verified_metadata` no longer includes that field."
      **Add step**: `await t.step("get_user_verified_metadata does not include field after admin removal", ...)`
      **Assert**: After `remove_admin_verified_metadata`, calling `get_user_verified_metadata` for the same user omits the removed key entirely.
      **Spec ref**: domain-admin-010 Expected behavior bullet 2

---

### domain-admin-006 — Domain administrators can delete archived verification keys

File: [src/requirements/domain-admin/006-delete-historical-key.requirement.test.ts](src/requirements/domain-admin/006-delete-historical-key.requirement.test.ts)  
Score: 0.50 · Statements: 0 ✓ / 1 ⚠ / 1 ✗

- [ ] **Statement** (✗ uncovered): "Deleting a key makes prior attestations signed by that key unverifiable."
      **Add step**: `await t.step("attestation signed by deleted key fails verification", ...)`
      **Assert**: Invitation signed with the now-deleted key is rejected; verification error references the missing key.
      **Spec ref**: domain-admin-006 Expected behavior bullet 2

- [ ] **Statement** (⚠ partial — deletion confirmed but impact on in-flight verification not tested): "The active key cannot be deleted; only archived (rotated-out) keys can be removed."
      **Add step**: `await t.step("attempting to delete the active key returns an error", ...)`
      **Assert**: `delete_historical_key` called with the current active key ID returns `error.code === "E_KEY_NOT_FOUND"` or equivalent protection error.
      **Spec ref**: domain-admin-006 Expected behavior bullet 1

---

### deployment-001 — Single-Tenant-Per-Instance Deployment

File: [src/requirements/deployment/001-single-tenant-per-instance.requirement.test.ts](src/requirements/deployment/001-single-tenant-per-instance.requirement.test.ts)  
Score: 0.67 · Statements: 1 ✓ / 2 ⚠ / 0 ✗

- [ ] **Statement** (⚠ partial — single-domain isolation implied but two-instance test not present): "Each domain's instance has isolated KV storage (cannot read/write another domain's data)."
      **Add step**: `await t.step("two server instances have isolated KV storage", ...)`
      **Assert**: Start two servers with separate `kvPath` values; data written to server A is not returned by server B for the same key.
      **Spec ref**: deployment-001 Testing section

- [ ] **Statement** (⚠ partial — auth scoping per-instance implied but cross-instance token test not present): "A token for domain A cannot access domain B's MCP tools."
      **Add step**: `await t.step("token issued for domain A is rejected by domain B instance", ...)`
      **Assert**: Token with `aud: "https://domainA.example"` returns 401 on domain B instance (different audience).
      **Spec ref**: deployment-001 Testing section

---

### invitations-003 — Listeners can accept a pending invitation

File: [src/requirements/invitations/003-accept-invitation.requirement.test.ts](src/requirements/invitations/003-accept-invitation.requirement.test.ts)  
Score: 0.75 · Statements: 5 ✓ / 2 ⚠ / 0 ✗

- [ ] **Statement** (⚠ partial — acceptance tested but narrower terms negotiation not isolated): "Acceptance MAY use narrower terms than proposed, following Section 9.3."
      **Add step**: `await t.step("accept_invitation with narrower terms issues receipt for only accepted subset", ...)`
      **Assert**: Invite proposes `{ category: ["billing", "correspondence"] }`; acceptance with `{ category: ["billing"] }` only issues one receipt for `billing`.
      **Spec ref**: invitations-003 bullet 7

- [ ] **Statement** (⚠ partial — single receipt per acceptance tested but multi-category receipt issuance not isolated): "If multiple categories are accepted, the server issues one receipt per accepted category."
      **Add step**: `await t.step("accepting multi-category invitation issues one receipt per category", ...)`
      **Assert**: Invitation with `proposed_terms.category: ["billing", "correspondence"]` accepted in full returns response with two `receipt` objects.
      **Spec ref**: invitations-003 bullet 8

---

### well-known-001 — Domain identity well-known endpoint

File: [src/requirements/well-known-paths.requirement.test.ts](src/requirements/well-known-paths.requirement.test.ts)  
Score: 0.70 · Statements: 3 ✓ / 2 ⚠ / 0 ✗

- [ ] **Statement** (⚠ partial — required fields tested; optional `domain_type` not covered): "The response MAY include `domain_type` — one of `personal`, `business`, `academic`, `government`, `nonprofit`, `healthcare`, `media`."
      **Add step**: `await t.step("well-known endpoint includes domain_type when configured", ...)`
      **Assert**: With `RPP_DOMAIN_TYPE=business` set, `.well-known/rpp-domain-identity` JSON includes `domain_type: "business"`.
      **Spec ref**: well-known-001 MAY field definitions

- [ ] **Statement** (⚠ partial — required fields tested; optional `public_key` not covered): "The response MAY include `public_key` with `algorithm: \"Ed25519\"` and Base64-encoded SPKI `key`."
      **Add step**: `await t.step("well-known endpoint includes public_key with Ed25519 algorithm when configured", ...)`
      **Assert**: When domain has a verification key, `.well-known/rpp-domain-identity` includes `public_key.algorithm === "Ed25519"` and `public_key.key` is a non-empty Base64 string.
      **Spec ref**: well-known-001 MAY field definitions

---

## Missing test files

_None._

**Scope**: all  
**Methodology**: Statement-level semantic scoring — 1.0 covered · 0.5 partial · 0.0 uncovered  
**Note**: `receptive-policy-007` test file was missed by extractor but exists and has 7 steps (scored from known content).

---

## Overall

| Metric | Score |
|--------|-------|
| Requirements fully covered (≥ 0.80) | 20 / 78 (26%) |
| Requirements partially covered (0.40 – 0.79) | 30 / 78 (38%) |
| Requirements uncovered (< 0.40) | 28 / 78 (36%) |
| **Statement-weighted coverage** | **225.5 / 555 = 41%** |

---

## By Category

| Category | Reqs | Stmts | Stmt-wt% | Covered ≥0.80 | Partial 0.40–0.79 | Uncovered |
|----------|------|-------|----------|---------------|-------------------|-----------|
| _root | 3 | 23 | 63% | 2 | 1 | 0 |
| account | 10 | 67 | 63% | 2 | 6 | 2 |
| contacts | 7 | 46 | 68% | 3 | 4 | 0 |
| deployment | 1 | 4 | 75% | 0 | 1 | 0 |
| domain-admin | 13 | 58 | 74% | 7 | 6 | 0 |
| invitations | 9 | 79 | 34% | 0 | 3 | 6 |
| mcp | 2 | 16 | 59% | 0 | 2 | 0 |
| mcp/auth | 12 | 61 | 76% | 5 | 7 | 0 |
| messages | 6 | 52 | **0%** | 0 | 0 | 6 |
| receipts | 4 | 32 | **0%** | 0 | 0 | 4 |
| receptive-policy | 7 | 64 | 13% | 1 | 0 | 6 |
| submit | 4 | 53 | **0%** | 0 | 0 | 4 |
| **TOTAL** | **78** | **555** | **41%** | **20** | **30** | **28** |

---

## By Requirement

| ID | Title | Score | Detail |
|----|-------|-------|--------|
| config-001 | Default local KV path is configurable | **0.90** | ✅ covered |
| startup-001 | Application starts without error | **0.83** | ✅ covered |
| well-known-001 | Domain identity well-known endpoint | 0.50 | ⚠ partial — MAY fields and peer-fallback not tested |
| account-001 | Account is server-local identity for authenticated listener | 0.63 | ⚠ partial — "not publicly addressable" and "no display_name required" not tested |
| account-002 | Account is auto-provisioned on first authenticated MCP request | 0.56 | ⚠ partial — upsert semantics and admin_verified_fields init not tested |
| account-003 | Account MAY have an optional display name | 0.20 | ❌ uncovered — Unicode/length constraint, set/get ops not tested |
| account-004 | All MCP tool operations are scoped to the authenticated account | 0.50 | ⚠ partial — cross-account create isolation not tested |
| account-005 | Domain tools require domain.admin role from token roles claim | **0.94** | ✅ covered |
| account-006 | MCP exposes permission introspection tool for current account | 0.30 | ❌ uncovered — response fields not verified, no arbitrary-lookup rejection test |
| account-007 | Users can refresh their own verified metadata from their token | 0.72 | ⚠ partial — visibility in list_verifiable_users and return value not tested |
| account-008 | Accounts are assigned an immutable domain_id at creation | 0.67 | ⚠ partial — "MUST NOT be settable via MCP tool" not tested |
| account-009 | domain_id is an immutable claim provided by the domain | **1.00** | ✅ covered |
| account-010 | Sender domain_id always included on outgoing invitations | 0.57 | ⚠ partial — "no domain_id → assign one", "always from admin_verified_fields", "receiver stores claims" not tested |
| contacts-001 | Contact auto-creation on invitation acceptance | 0.50 | ⚠ partial — owner_oid, message-via-submit no-create, immutability on update not tested |
| contacts-002 | Contact field accumulation from invitation claims | 0.63 | ⚠ partial — source "owner_note" for set_contact_field records not tested |
| contacts-003 | list_contacts tool | **0.88** | ✅ covered |
| contacts-004 | get_contact tool | **0.88** | ✅ covered |
| contacts-005 | delete_contact tool | 0.67 | ⚠ partial — "does not revoke receipts" not tested |
| contacts-006 | invite_contact tool | 0.50 | ⚠ partial — uses contact.domain as receiver_domain not tested |
| contacts-007 | Owner-authored custom field on a contact | **0.93** | ✅ covered |
| deployment-001 | Single-tenant-per-instance deployment | 0.75 | ⚠ partial — infrastructure-level isolation implied not explicit |
| domain-admin-001 | Domain administrators can retrieve domain identity | **0.83** | ✅ covered |
| domain-admin-002 | Domain administrators can update domain identity fields | **1.00** | ✅ covered |
| domain-admin-003 | Domain administrators can retrieve the active verification key | **0.83** | ✅ covered |
| domain-admin-004 | Domain administrators can rotate the invitation verification key | **0.88** | ✅ covered |
| domain-admin-005 | Domain administrators can list archived verification keys | **0.90** | ✅ covered |
| domain-admin-006 | Domain administrators can delete archived verification keys | 0.75 | ⚠ partial — "makes prior attestations unverifiable" not tested |
| domain-admin-007 | Domain administrators can list verifiable users | **0.80** | ✅ covered |
| domain-admin-008 | Domain administrators can retrieve a user's verified metadata | 0.70 | ⚠ partial — merged value precedence not explicitly tested |
| domain-admin-009 | Domain administrators can set admin verified metadata | 0.50 | ⚠ partial — "must not modify user_verified_fields", tool returns result not tested |
| domain-admin-010 | Domain administrators can remove admin verified metadata | 0.60 | ⚠ partial — effective view recalculation and invitation reconciliation not tested |
| domain-admin-011 | Domain administrators can retrieve contact policy URL | 0.63 | ⚠ partial — "reflects domain identity state" not tested |
| domain-admin-012 | Domain administrators can set contact policy URL | **1.00** | ✅ covered |
| domain-admin-013 | Domain identity includes port when non-standard | 0.50 | ⚠ partial — port-443 case and RPP_DOMAIN override not tested |
| invitations-001 | Listeners can list their invitations | 0.64 | ⚠ partial — summary field contents not explicitly tested |
| invitations-002 | Listeners can review a pending invitation | 0.58 | ⚠ partial — terms/expiry fields, scoping to caller not tested |
| invitations-003 | Listeners can accept a pending invitation | 0.44 | ⚠ partial — negotiated terms, per-category receipts, error surfacing not tested |
| invitations-004 | Listeners can reject a pending invitation | **0.00** | ❌ uncovered — NO TEST FILE |
| invitations-005 | Listeners can send invitations via policy ID or receipt ID | 0.32 | ❌ uncovered — delivery block, token persistence, non-reuse, error surfacing not tested |
| invitations-006 | Senders can attach verified and custom claims to outgoing invitations | 0.50 | ⚠ partial — claim value constraints, server inbound validation, immutable opt-out not tested |
| invitations-007 | Receivers deliver acceptance/rejection callback to inviting domain | 0.22 | ❌ uncovered — HMAC signing, endpoint resolution, retry backoff, token single-use not tested |
| invitations-008 | Inviting domains process inbound receipt callbacks | 0.42 | ⚠ partial — expiry check, receipt-superseding, rejection path, HTTP 202 not tested |
| invitations-009 | Senders can cancel a direct invitation | **0.00** | ❌ uncovered — NO TEST FILE |
| messages-001 | Listeners can send messages using a held receipt | **0.00** | ❌ uncovered — NO TEST FILE |
| messages-002 | Listeners can list messages in their inbox | **0.00** | ❌ uncovered — NO TEST FILE |
| messages-003 | Listeners can retrieve a single message by ID | **0.00** | ❌ uncovered — NO TEST FILE |
| messages-004 | Listeners can mark messages as read | **0.00** | ❌ uncovered — NO TEST FILE |
| messages-005 | Listeners can delete a message from their local store | **0.00** | ❌ uncovered — NO TEST FILE |
| messages-006 | Message responses include all recorded claims from sender | **0.00** | ❌ uncovered — NO TEST FILE |
| receipts-001 | Accepting an invitation issues and records a receipt | **0.00** | ❌ uncovered — NO TEST FILE |
| receipts-002 | Listeners can list receipts they have issued | **0.00** | ❌ uncovered — NO TEST FILE |
| receipts-003 | Listeners can revoke an issued receipt | **0.00** | ❌ uncovered — NO TEST FILE |
| receipts-004 | Receipt superseding on new acceptance | **0.00** | ❌ uncovered — NO TEST FILE |
| receptive-policy-001 | Listeners can list their receptive policies | **0.00** | ❌ uncovered — NO TEST FILE |
| receptive-policy-002 | Listeners can add a receptive policy | **0.00** | ❌ uncovered — NO TEST FILE |
| receptive-policy-003 | Listeners can open a time-bounded receptive window | **0.00** | ❌ uncovered — NO TEST FILE |
| receptive-policy-004 | Contact-based receptive policy | **0.00** | ❌ uncovered — NO TEST FILE |
| receptive-policy-005 | Receipt-based receptive policy | **0.00** | ❌ uncovered — NO TEST FILE |
| receptive-policy-006 | Listeners can remove a receptive policy | **0.00** | ❌ uncovered — NO TEST FILE |
| receptive-policy-007 | Receptive windows expose a shareable shortcode | **0.80** | ✅ covered — atomicity of index write not tested |
| submit-001 | Servers expose an envelope endpoint | **0.00** | ❌ uncovered — NO TEST FILE |
| submit-002 | Envelope requests are authenticated with HMAC | **0.00** | ❌ uncovered — NO TEST FILE |
| submit-003 | Envelope requests are protected against replay | **0.00** | ❌ uncovered — NO TEST FILE |
| submit-004 | Envelope requests are validated against schema | **0.00** | ❌ uncovered — NO TEST FILE |
| mcp-001 | Tools use structured output with outputSchema | 0.56 | ⚠ partial — registerTool requirement, toolResult() helper not tested |
| mcp-002 | MCP server lists all registered tools via tools/list | 0.64 | ⚠ partial — per-tool field presence (name/desc/inputSchema) not verified |
| mcp-auth-001 | Server exposes MCP endpoint for listener workflows | 0.50 | ⚠ partial — path stability/documentation not tested |
| mcp-auth-002 | MCP endpoint requires bearer token authentication | 0.75 | ⚠ partial — "applies to all operations" not verified exhaustively |
| mcp-auth-003 | Bearer token supplied only in Authorization header | 0.67 | ⚠ partial — non-bearer format (e.g., Basic) rejection not tested |
| mcp-auth-004 | Access token validation enforces audience and token validity | **1.00** | ✅ covered |
| mcp-auth-005 | Client bearer tokens are never forwarded upstream | **0.88** | ✅ covered |
| mcp-auth-006 | OAuth discovery metadata is published for MCP authentication | **0.80** | ✅ covered |
| mcp-auth-007 | Unauthorized responses include OAuth challenge metadata | **1.00** | ✅ covered |
| mcp-auth-008 | MCP endpoint validates Origin header | 0.75 | ⚠ partial — origin validation before sensitive ops not explicitly tested |
| mcp-auth-009 | MCP and OAuth endpoints are served over HTTPS | 0.75 | ⚠ partial — "non-compliant in non-dev" not explicitly tested |
| mcp-auth-010 | MCP authentication failures use standardized HTTP status codes | 0.58 | ⚠ partial — E_ prefix machine-readability and response stability not tested |
| mcp-auth-011 | OAuth authorization flow uses canonical resource indicator | 0.63 | ⚠ partial — resource targeting unambiguousness not tested |
| mcp-auth-012 | Azure AD/Entra ID Token v2.0 Compatibility | **0.80** | ✅ covered |

---

## Significant Gaps

### P0: Categories with Zero Coverage (201 uncovered statements)

These entire feature areas have no requirement tests at all.

#### messages (6 requirements · 52 statements · 0%)

All 6 message tool requirements are completely untested. No test files exist for:
- `send_message` — receipt ownership check, UUIDv7 generation, HMAC envelope construction, E_RECEIPT_NOT_ACTIVE, E_MESSAGE_TOO_LARGE
- `list_messages` — filtering, descending order, resume-token pagination
- `get_message` — account scoping, full envelope return
- `mark_read` — idempotency, read_at not updated for already-read, multi-message array
- `delete_message` — atomic deletion, no receipt revocation
- `sender_claims` — both list/get include flat-merged contact fields

#### receipts (4 requirements · 32 statements · 0%)

No test files for:
- Receipt issuance on acceptance — secret generation, initial active status, delivery
- `list_issued_receipts` — status/domain filtering, account scoping
- `revoke_receipt` — immediate revocation, cross-account rejection, idempotency
- Receipt superseding — domain_id matching, exactly-one-active invariant, SUPERSEDED reason

#### submit (4 requirements · 53 statements · 0%)

No test files for:
- Envelope endpoint POST acceptance — 202 response, dispatch by category
- HMAC authentication — signature/timestamp headers, key resolution, rejection codes
- Replay protection — 60-second window, deduplication cache per envelope kind
- Schema validation — 256KB limit, required fields, content_type values

#### receptive-policy 001–006 (6 requirements · 54 statements · 0%)

Only `receptive-policy-007` (shortcode) is tested. No tests for:
- `get_receptive_policies` — pagination, receipt policy exclusion by default
- `add_receptive_policy` — all modes, receipt mode rejection, mode-specific validation
- `open_receptive_window` — duration_seconds, receptive_until computation, expiry enforcement
- `contact` mode policy — exact domain_id + case-insensitive domain matching
- `receipt` mode auto-creation — on acceptance, on revoke deletion
- `remove_receptive_policy` — atomic KV deletion, not-found error, receipt-mode does not revoke receipt

---

### P1: Invitations (9 reqs · 79 statements · 34%)

#### invitations-004: reject_invitation — NO TEST FILE (0%)

Uncovered statements:
- `reject_invitation` transitions invitation from `pending` → `rejected`
- Rejection MUST NOT issue any receipt
- Server MUST construct `category: "receipt"` envelope with `decision: "rejected"`

#### invitations-009: cancel_invitation — NO TEST FILE (0%)

Uncovered statements:
- `cancel_invitation` accepts `pending` OR `accepted` state
- All derived receipts MUST be immediately invalidated
- Terminal-state cancellation returns structured error

#### invitations-005: send_invitation (0.32)

Uncovered statements:
- MUST attach delivery block with `domain` and freshly generated single-use `token`
- MUST persist `(invitation_id, delivery_token)` pair locally
- Tokens MUST NOT be reused across invitations
- If receiver rejects submission, tool MUST surface a structured error

#### invitations-007: receipt callback delivery (0.22)

Uncovered statements:
- Server signs request with HMAC-SHA-256 before delivery
- Delivery is idempotent
- On transient failure: retry with bounded exponential backoff
- On permanent failure: mark invitation `undelivered`
- `delivery.token` is single-use

#### invitations-008: receipt callback handler (0.42)

Uncovered statements:
- Handler verifies invitation is still in `pending` state
- Handler verifies invitation has not expired
- Handler MUST trigger receipt-superseding semantics if applicable
- On `decision: "rejected"`: no receipt stored, invitation transitions to `rejected`
- Handler responds with HTTP 202

---

### P2: Weak Coverage in Otherwise-Tested Requirements

#### account-003: Account display name (0.20)
Missing: display name up-to-256 code-point constraint, `set_display_name` success path, `get_display_name` return.

#### account-006: get_permissions (0.30)
Missing: response fields `account_id`, `oid`, `roles`, `is_domain_admin`, `allowed_tool_groups` explicitly verified; tool must not accept arbitrary account identifiers.

#### mcp-auth-010: Error status codes (0.58)
Missing: `E_` prefix machine-readability on error codes; error response stability.

#### domain-admin-013: Port in domain identity (0.50)
Missing: port-443 + non-localhost must omit port; `RPP_DOMAIN` env override of automatic derivation.

#### well-known-001: /.well-known/rpp-domain-identity (0.50)
Missing: individual field assertions for all MUST fields; peer-fallback to conventional paths.

---

## Suggestions

### Create test files for zero-coverage categories

Priority order: **submit → receipts → messages → receptive-policy 001–006 → invitations-004 → invitations-009**

These follow the acceptance-flow dependency chain: submit must work before receipts, receipts before messages.

---

### invitations-005: delivery block and token persistence

```typescript
await t.step("outbound invitation envelope includes delivery block with domain and token", async () => {
  // inspect the envelope delivered to the receiver's submit endpoint
  // assert delivery.domain === sender domain
  // assert delivery.token is a non-empty string
});

await t.step("delivery token is unique across separate invitations", async () => {
  // send two invitations, compare delivery.token values
  // assert they differ
});
```

### invitations-007: HMAC signing of receipt callback

```typescript
await t.step("receipt callback is signed with HMAC-SHA-256 in x-rpp-signature header", async () => {
  // capture the POST to the inviting domain's endpoint
  // verify x-rpp-signature header is present
  // verify HMAC-SHA-256(delivery_token, timestamp + "." + body) matches signature
});

await t.step("receipt callback delivery retries on transient failure", async () => {
  // simulate server returning 503, then 202
  // verify the callback was eventually delivered
});
```

### invitations-008: rejection path and HTTP 202 response

```typescript
await t.step("receipt callback handler returns HTTP 202 on success", async () => {
  // POST a valid receipt envelope
  // assert response status === 202
});

await t.step("receipt callback handler rejects callback for already-accepted invitation", async () => {
  // POST the callback twice
  // second POST should return E_INVITATION_NOT_PENDING
});
```

### account-003: display name constraints

```typescript
await t.step("set_display_name stores a Unicode display name", async () => {
  // call set_display_name with a Unicode string ≤ 256 code points
  // call get_display_name and verify it matches
});

await t.step("set_display_name rejects strings longer than 256 code points", async () => {
  // call set_display_name with a 257-character string
  // assert structured validation error
});
```

### account-006: get_permissions response shape

```typescript
await t.step("get_permissions response includes all required fields", async () => {
  // call get_permissions
  // assert result has: account_id, oid, roles, is_domain_admin, allowed_tool_groups
});

await t.step("get_permissions does not accept an account_id argument", async () => {
  // call get_permissions with { account_id: "other-id" }
  // assert the response reflects the caller's own permissions, not the supplied id
});
```

### receptive-policy-003: open_receptive_window core behavior

```typescript
await t.step("open_receptive_window creates a policy with receptive_until = now + duration_seconds", async () => {
  const before = new Date();
  const policy = await openWindow({ duration_seconds: 300 });
  const after = new Date();
  // assert policy.receptive_until ≈ before + 300s (within a few seconds)
});

await t.step("invitation is rejected after receptive_until has passed", async () => {
  const policy = await openWindow({ duration_seconds: 1 });
  await sleep(1500);
  // attempt to send invitation using policy.policy_id
  // assert E_RECEPTIVE_POLICY_EXPIRED
});
```

### submit-002: HMAC authentication

```typescript
await t.step("submit endpoint rejects request with missing x-rpp-signature header", async () => {
  const res = await submitEnvelope(envelope, { omitSignature: true });
  assertEquals(res.status, 403);
});

await t.step("submit endpoint rejects request with invalid HMAC signature", async () => {
  const res = await submitEnvelope(envelope, { badSignature: "0".repeat(64) });
  assertEquals(res.status, 403);
});

await t.step("submit endpoint accepts request with valid HMAC signature", async () => {
  const res = await submitEnvelope(envelope);
  assertEquals(res.status, 202);
});
```

### receptive-policy-007: atomic shortcode index write

```typescript
await t.step("shortcode index entry is written atomically with policy record", async () => {
  // open a receptive window — if shortcode is returned, the index must already exist
  const policy = await openReceptiveWindow({ duration_seconds: 3600 });
  // immediately use shortcode to send invitation (no delay)
  const result = await sendInvitationByShortcode(policy.shortcode);
  assertEquals(result.isOk, true);
});
```
