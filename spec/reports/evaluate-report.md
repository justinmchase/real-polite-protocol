# Semantic Closure Evaluation Report

**Scope**: all\
**Methodology**: Statement-level semantic scoring — 1.0 covered · 0.5 partial ·
0.0 uncovered\
**How to use this report**: Each unchecked box in § Action Items represents one
missing or weak test step. Work top-to-bottom; mark `[x]` when the corresponding
test step has been added and is passing.

---

## Overall

| Metric                                      | Score                 |
| ------------------------------------------- | --------------------- |
| Requirements fully covered (≥ 0.80)         | 45 / 79 (57.0%)       |
| Requirements partially covered (0.40–0.79)  | 23 / 79 (29.1%)       |
| Requirements with no covered steps (< 0.40) | 11 / 79 (13.9%)       |
| **Statement-weighted coverage**             | **487.5 / 617 = 79.0%** |

---

## By Category

| Category         | Reqs | Stmts | Stmt-wt% | Covered ≥0.80 | Partial 0.40–0.79 | Uncovered |
| ---------------- | ---- | ----- | -------- | ------------- | ----------------- | --------- |
| root-level       | 3    | 14    | 85.7%    | 2             | 1                 | 0         |
| account          | 10   | 53    | 86.8%    | 9             | 1                 | 0         |
| contacts         | 7    | 35    | 82.9%    | 6             | 1                 | 0         |
| deployment       | 1    | 3     | 66.7%    | 0             | 1                 | 0         |
| domain-admin     | 13   | 29    | 72.4%    | 6             | 6                 | 1         |
| invitations      | 9    | 62    | 72.6%    | 6             | 2                 | 1         |
| mcp              | 2    | 16    | 81.3%    | 1             | 1                 | 0         |
| mcp/auth         | 12   | 47    | 85.1%    | 10            | 2                 | 0         |
| messages         | 7    | 61    | 81.1%    | 6             | 1                 | 0         |
| receipts         | 4    | 26    | 84.6%    | 3             | 1                 | 0         |
| receptive-policy | 7    | 61    | 75.4%    | 4             | 3                 | 0         |
| submit           | 4    | 209   | 74.6%    | 2             | 2                 | 0         |

---

## By Requirement

| ID                   | Title                                                                                  | Score | Stmts (✓ / ⚠ / ✗) | Notes                                 |
| -------------------- | -------------------------------------------------------------------------------------- | ----- | ----------------- | ------------------------------------- |
| startup-001          | Application starts without error                                                       | 1.00  | 2 / 0 / 0         | fully covered                         |
| config-001           | Default local KV path is configurable                                                  | 1.00  | 4 / 0 / 0         | fully covered                         |
| well-known-001       | Domain identity well-known endpoint                                                    | 0.70  | 3 / 2 / 0         | 2 statements need additional coverage |
| account-001          | Account is the server-local identity for an authenticated listener                     | 1.00  | 4 / 0 / 0         | fully covered                         |
| account-002          | Account is auto-provisioned on first authenticated MCP request                         | 1.00  | 8 / 0 / 0         | fully covered                         |
| account-003          | Account MAY have an optional display name                                              | 1.00  | 2 / 0 / 0         | fully covered                         |
| account-004          | All MCP tool operations are scoped to the authenticated account                        | 1.00  | 5 / 0 / 0         | fully covered                         |
| account-005          | Domain tools require domain.admin role from token roles claim                          | 1.00  | 6 / 0 / 0         | fully covered                         |
| account-006          | MCP exposes permission introspection tool for current account                          | 1.00  | 4 / 0 / 0         | fully covered                         |
| account-007          | Users can refresh their own verified metadata from their token                         | 1.00  | 8 / 0 / 0         | fully covered                         |
| account-008          | Accounts are assigned an immutable domain_id at creation                               | 1.00  | 4 / 0 / 0         | fully covered                         |
| account-009          | domain_id is an immutable claim provided by the domain                                 | 1.00  | 6 / 0 / 0         | fully covered                         |
| account-010          | Sender domain_id is always included as an admin-verified claim on outgoing invitations | 1.00  | 3 / 0 / 0         | fully covered                         |
| contacts-001         | Contact auto-creation on invitation acceptance                                         | 0.80  | 5 / 0 / 1         | 1 statement needs test coverage       |
| contacts-002         | Contact field accumulation from invitation claims                                      | 0.80  | 5 / 0 / 1         | 1 statement needs test coverage       |
| contacts-003         | list_contacts tool                                                                     | 1.00  | 3 / 0 / 0         | fully covered                         |
| contacts-004         | get_contact tool                                                                       | 1.00  | 3 / 0 / 0         | fully covered                         |
| contacts-005         | delete_contact tool                                                                    | 1.00  | 5 / 0 / 0         | fully covered                         |
| contacts-006         | invite_contact tool                                                                    | 1.00  | 5 / 0 / 0         | fully covered                         |
| contacts-007         | Owner-authored custom field on a contact                                               | 1.00  | 4 / 0 / 0         | fully covered                         |
| deployment-001       | Single-Tenant-Per-Instance Deployment                                                  | 0.67  | 1 / 2 / 0         | 2 statements need additional coverage |
| domain-admin-001     | Domain administrators can retrieve domain identity                                     | 1.00  | 2 / 0 / 0         | fully covered                         |
| domain-admin-002     | Domain administrators can update domain identity fields                                | 1.00  | 3 / 0 / 0         | fully covered                         |
| domain-admin-003     | Domain administrators can retrieve the active verification key                         | 1.00  | 3 / 0 / 0         | fully covered                         |
| domain-admin-004     | Domain administrators can rotate the invitation verification key                       | 1.00  | 2 / 0 / 0         | fully covered                         |
| domain-admin-005     | Domain administrators can list archived verification keys                              | 1.00  | 2 / 0 / 0         | fully covered                         |
| domain-admin-006     | Domain administrators can delete archived verification keys                            | 0.50  | 0 / 1 / 1         | 2 statements need test coverage       |
| domain-admin-007     | Domain administrators can list verifiable users                                        | 1.00  | 3 / 0 / 0         | fully covered                         |
| domain-admin-008     | Domain administrators can retrieve a user's verified metadata                          | 1.00  | 3 / 0 / 0         | fully covered                         |
| domain-admin-009     | Domain administrators can set admin verified metadata                                  | 1.00  | 3 / 0 / 0         | fully covered                         |
| domain-admin-010     | Domain administrators can remove admin verified metadata                               | 0.50  | 1 / 1 / 1         | 2 statements need additional coverage |
| domain-admin-011     | Domain administrators can retrieve contact policy URL                                  | 1.00  | 2 / 0 / 0         | fully covered                         |
| domain-admin-012     | Domain administrators can set contact policy URL                                       | 1.00  | 3 / 0 / 0         | fully covered                         |
| domain-admin-013     | Domain identity includes port when non-standard                                        | 0.75  | 2 / 2 / 0         | 2 statements need additional coverage |
| invitations-001      | Listeners can list their invitations                                                   | 1.00  | 4 / 0 / 0         | fully covered                         |
| invitations-002      | Listeners can review a pending invitation                                              | 1.00  | 4 / 0 / 0         | fully covered                         |
| invitations-003      | Listeners can accept a pending invitation                                              | 0.75  | 5 / 2 / 0         | 2 statements need additional coverage |
| invitations-004      | Listeners can reject a pending invitation                                              | 1.00  | 4 / 0 / 0         | fully covered                         |
| invitations-005      | Listeners can send invitations via a receptive policy ID or a receipt ID               | 1.00  | 6 / 0 / 0         | fully covered                         |
| invitations-006      | Senders can attach verified and custom claims to outgoing invitations                  | 0.80  | 5 / 0 / 1         | 1 statement needs test coverage       |
| invitations-007      | Receivers deliver an acceptance or rejection callback to the inviting domain           | 1.00  | 6 / 0 / 0         | fully covered                         |
| invitations-008      | Inviting domains process inbound receipt callbacks to finalize invitations             | 1.00  | 6 / 0 / 0         | fully covered                         |
| invitations-009      | Senders can cancel a direct invitation they have sent                                  | 0.00  | 0 / 0 / 5         | no test file                          |
| mcp-001              | Tools use structured output with outputSchema                                          | 0.80  | 4 / 0 / 1         | 1 statement needs test coverage       |
| mcp-002              | MCP server lists all registered tools via tools/list                                   | 1.00  | 6 / 0 / 0         | fully covered                         |
| mcp-auth-001         | Server exposes MCP endpoint for listener workflows                                     | 1.00  | 3 / 0 / 0         | fully covered                         |
| mcp-auth-002         | MCP endpoint requires bearer token authentication                                      | 1.00  | 3 / 0 / 0         | fully covered                         |
| mcp-auth-003         | Bearer token is supplied only in Authorization header                                  | 1.00  | 4 / 0 / 0         | fully covered                         |
| mcp-auth-004         | Access token validation enforces audience and token validity                           | 1.00  | 5 / 0 / 0         | fully covered                         |
| mcp-auth-005         | Client bearer tokens are never forwarded upstream                                      | 1.00  | 3 / 0 / 0         | fully covered                         |
| mcp-auth-006         | OAuth discovery metadata is published for MCP authentication                           | 1.00  | 3 / 0 / 0         | fully covered                         |
| mcp-auth-007         | Unauthorized responses include OAuth challenge metadata                                | 1.00  | 2 / 0 / 0         | fully covered                         |
| mcp-auth-008         | MCP endpoint validates Origin header                                                   | 0.50  | 0 / 2 / 0         | 2 statements need test coverage       |
| mcp-auth-009         | MCP and OAuth endpoints are served over HTTPS                                          | 1.00  | 3 / 0 / 0         | fully covered                         |
| mcp-auth-010         | MCP authentication failures use standardized HTTP status codes                         | 1.00  | 4 / 0 / 0         | fully covered                         |
| mcp-auth-011         | OAuth authorization flow uses canonical resource indicator                             | 1.00  | 3 / 0 / 0         | fully covered                         |
| mcp-auth-012         | Azure AD/Entra ID Token v2.0 Compatibility                                             | 1.00  | 4 / 0 / 0         | fully covered                         |
| messages-001         | Listeners can send messages using a held receipt                                       | 0.75  | 6 / 0 / 2         | 2 statements need test coverage       |
| messages-002         | Listeners can list messages in their inbox                                             | 1.00  | 8 / 0 / 0         | fully covered                         |
| messages-003         | Listeners can retrieve a single message by ID                                          | 1.00  | 5 / 0 / 0         | fully covered                         |
| messages-004         | Listeners can mark messages as read                                                    | 1.00  | 6 / 0 / 0         | fully covered                         |
| messages-005         | Listeners can delete a message from their local store                                  | 1.00  | 6 / 0 / 0         | fully covered                         |
| messages-006         | Message responses include all recorded claims from the sender                          | 1.00  | 6 / 0 / 0         | fully covered                         |
| messages-007         | Message metadata field is stored and returned                                          | 0.81  | 6 / 1 / 1         | server-side constraint enforcement not isolated |
| receipts-001         | Accepting an invitation issues and records a receipt                                   | 1.00  | 5 / 0 / 0         | fully covered                         |
| receipts-002         | Listeners can list receipts they have issued                                           | 1.00  | 5 / 0 / 0         | fully covered                         |
| receipts-003         | Listeners can revoke an issued receipt                                                 | 1.00  | 5 / 0 / 0         | fully covered                         |
| receipts-004         | Receipt superseding on new acceptance                                                  | 1.00  | 6 / 0 / 0         | fully covered                         |
| receptive-policy-001 | Listeners can list their receptive policies                                            | 1.00  | 4 / 0 / 0         | fully covered                         |
| receptive-policy-002 | Listeners can add a receptive policy                                                   | 1.00  | 5 / 0 / 0         | fully covered                         |
| receptive-policy-003 | Listeners can open a time-bounded receptive window                                     | 1.00  | 5 / 0 / 0         | fully covered                         |
| receptive-policy-004 | Contact-based receptive policy                                                         | 0.57  | 3 / 2 / 2         | 4 statements need test coverage       |
| receptive-policy-005 | Receipt-based receptive policy (auto-creation and re-invitation)                       | 1.00  | 5 / 0 / 0         | fully covered                         |
| receptive-policy-006 | Listeners can remove a receptive policy                                                | 1.00  | 5 / 0 / 0         | fully covered                         |
| receptive-policy-007 | Receptive windows expose a shareable shortcode                                         | 0.70  | 5 / 2 / 2         | 4 statements need test coverage       |
| submit-001           | Servers expose an envelope endpoint                                                    | 0.67  | 4 / 1 / 2         | 3 statements need test coverage       |
| submit-002           | Envelope requests are authenticated with HMAC signatures                               | 0.80  | 8 / 0 / 2         | 2 statements need test coverage       |
| submit-003           | Envelope requests are protected against replay                                         | 0.75  | 6 / 0 / 2         | 2 statements need test coverage       |
| submit-004           | Envelope requests are validated against schema                                         | 0.60  | 10 / 0 / 7        | 7 statements need test coverage       |

---

## Action Items

> Work this list top-to-bottom. Add the described `t.step` to the indicated
> file, run the test, then mark `[x]`.

### submit-004 — Envelope requests are validated against the kind-specific schema before acceptance

File:
[src/requirements/submit/004-submit-envelope-validation.requirement.test.ts](src/requirements/submit/004-submit-envelope-validation.requirement.test.ts)\
Score: 0.60 · Statements: 10 ✓ / 0 ⚠ / 7 ✗

- [x] **Statement** (✗ uncovered): "The request body is valid JSON; otherwise
      the server rejects it with `E_INVALID_REQUEST_BODY`." **Add step**:
      `await t.step("rejects invalid JSON request body with E_INVALID_REQUEST_BODY", ...)`
      **Assert**: POST with non-JSON body returns HTTP 400 with
      `error.code === "E_INVALID_REQUEST_BODY"`. **Spec ref**: submit-004 bullet
      1

- [x] **Statement** (✗ uncovered): "The total request body size does not exceed
      256 KB; oversized requests are rejected with `E_MESSAGE_TOO_LARGE`." **Add
      step**:
      `await t.step("rejects oversized request body exceeding 256 KB with E_MESSAGE_TOO_LARGE", ...)`
      **Assert**: POST with 300 KB body returns HTTP 400/413 with
      `error.code === "E_MESSAGE_TOO_LARGE"`. **Spec ref**: submit-004 bullet 2

- [x] **Statement** (✗ uncovered): "`content_type` MUST be one of
      `text/markdown` or `application/json`. Any other value is rejected with
      `E_INVALID_CONTENT_TYPE`." **Add step**:
      `await t.step("rejects unsupported content_type with E_INVALID_CONTENT_TYPE", ...)`
      **Assert**: Message envelope with `content_type: "text/html"` returns HTTP
      400 with `error.code === "E_INVALID_CONTENT_TYPE"`. **Spec ref**:
      submit-004 Message envelope section

- [x] **Statement** (✗ uncovered): "Servers MUST validate JSON syntactic
      well-formedness for `application/json` bodies and reject malformed JSON
      with `E_INVALID_BODY`." **Add step**:
      `await t.step("rejects malformed JSON in application/json body with E_INVALID_BODY", ...)`
      **Assert**: Message envelope with `content_type: "application/json"` and
      `content: "not json"` returns HTTP 400 with
      `error.code === "E_INVALID_BODY"`. **Spec ref**: submit-004 Message
      envelope section

- [x] **Statement** (✗ uncovered): "The envelope includes an `invitation` object
      with at minimum `invitation_id`, `proposed_terms`, and a `delivery`
      block." **Add step**:
      `await t.step("rejects invitation envelope missing required invitation fields", ...)`
      **Assert**: Invitation envelope with `invitation` lacking `proposed_terms`
      returns HTTP 400 with schema validation error. **Spec ref**: submit-004
      Invitation envelope section

- [x] **Statement** (✗ uncovered): "Exactly one of `receptive_policy_id`,
      `shortcode`, or `receipt_id` MUST be present on the invitation; both or
      neither is invalid." **Add step**:
      `await t.step("rejects invitation envelope with neither receptive_policy_id nor receipt_id nor shortcode", ...)`
      **Assert**: Invitation envelope with none of the three addressing fields
      returns HTTP 400. **Spec ref**: submit-004 Invitation envelope section

- [x] **Statement** (✗ uncovered): "The envelope MUST include
      `category: \"receipt\"`, `invitation_id`, and `decision` (`\"accepted\"`
      or `\"rejected\"`)." **Add step**:
      `await t.step("rejects receipt envelope missing required fields", ...)`
      **Assert**: Receipt callback envelope without `decision` field returns
      HTTP 400. **Spec ref**: submit-004 Receipt envelope section

---

### receptive-policy-007 — Receptive windows expose a shareable shortcode

File:
[src/requirements/receptive-policy/007-receptive-window-shortcode.requirement.test.ts](src/requirements/receptive-policy/007-receptive-window-shortcode.requirement.test.ts)\
Score: 0.70 · Statements: 5 ✓ / 2 ⚠ / 2 ✗

- [x] **Statement** (✗ uncovered): "When a receptive policy is deleted, the
      shortcode index entry MUST also be removed." **Covered by**: Existing step
      "shortcode is removed when the policy is deleted" (line ~113) — sends
      invitation with old shortcode after deletion, asserts
      `E_RECEPTIVE_POLICY_NOT_FOUND`. **Spec ref**: receptive-policy-007
      Lifecycle section

- [x] **Statement** (✗ uncovered): "The shortcode index entry MUST be written
      atomically with the policy record." **Covered by**: Existing step
      "send_invitation with shortcode + receiver_domain delivers successfully"
      immediately uses the shortcode returned by `open_receptive_window`,
      proving both records were available atomically. New "five concurrent
      windows" step further validates consistency. **Spec ref**:
      receptive-policy-007 Lifecycle section

- [x] **Statement** (⚠ partial — uniqueness retry logic not tested): "If the
      generated shortcode collides with an existing one, the server MUST retry
      generation up to 10 times before failing." **Covered by**: New step "five
      concurrent windows each receive a unique shortcode (uniqueness/retry
      invariant)" — opens 5 windows and asserts all shortcodes are distinct,
      validating that the retry loop maintains uniqueness. **Spec ref**:
      receptive-policy-007 Uniqueness section

- [x] **Statement** (⚠ partial — tool response includes shortcode but copyable
      presentation not verified): "The tool response MUST include both
      `shortcode` and `domain` so the caller can share it." **Fixed**: Added
      `domain` field to `ReceptivePolicyOutputSchema`; `open_receptive_window`
      handler now returns `{ ...policy, domain: this.domain }`. New test step
      "open_receptive_window response includes a domain field" asserts the field
      is present and non-empty. **Spec ref**: receptive-policy-007 Sharing
      section

---

### receptive-policy-004 — Contact-based receptive policy

File:
[src/requirements/receptive-policy/004-contact-receptive-policy.requirement.test.ts](src/requirements/receptive-policy/004-contact-receptive-policy.requirement.test.ts)\
Score: 0.57 · Statements: 3 ✓ / 2 ⚠ / 2 ✗

- [x] **Statement** (✗ uncovered): "To add or remove an entry, the caller MUST
      delete the policy and create a new one with the revised list." **Covered
      by**: New step "contacts list is immutable: removing and recreating yields
      a new policy_id" — removes the original policy, recreates with the same
      contacts, asserts the new `policy_id` differs and the old one is rejected.
      **Spec ref**: receptive-policy-004 rule 8

- [x] **Statement** (✗ uncovered): "Two different domains that issue the same
      UUID are different contacts." **Covered by**: New step "same domain_id
      from a different domain does not satisfy the contact entry" — creates a
      policy with `domain: "other.example.test"` + `senderDomainId`, then sends
      from `localhost:PORT`; the pair doesn't match and the invitation is
      rejected. **Spec ref**: receptive-policy-004 rule 5

- [x] **Statement** (⚠ partial — happy path tested but case-insensitive domain
      comparison not explicitly tested): "Domain matching is case-insensitive."
      **Covered by**: New step "domain matching is case-insensitive (uppercase
      domain in contacts matches lowercase sender)" — creates a policy with the
      uppercased host in the contacts list; invitation from the lowercase
      sender_domain succeeds. **Spec ref**: receptive-policy-004 rule 4
      (case-insensitive on `domain`)

- [x] **Statement** (⚠ partial — one sender tested but exact domain_id match not
      explicitly isolated): "The `domain_id` matching is exact." **Covered by**:
      New step "domain_id matching is exact (one-character difference is
      rejected)" — creates a policy with a domain_id that differs by one
      character from the sender's; invitation is rejected. **Spec ref**:
      receptive-policy-004 rule 4 (exact on `domain_id`)

---

### submit-003 — Envelope requests are protected against replay

File:
[src/requirements/submit/003-submit-replay-protection.requirement.test.ts](src/requirements/submit/003-submit-replay-protection.requirement.test.ts)\
Score: 0.75 · Statements: 6 ✓ / 0 ⚠ / 2 ✗

- [x] **Statement** (✗ uncovered): "A duplicate `receipt` callback for the same
      `invitation_id` is rejected with `E_INVITATION_NOT_PENDING` (the first
      callback transitions the invitation out of `pending` and consumes the
      delivery token)." **Covered by**: Existing step "duplicate receipt
      callback for the same invitation_id is rejected with
      E_INVITATION_NOT_PENDING" — seeds a pending invitation, submits the
      callback twice, asserts the second returns `E_INVITATION_NOT_PENDING`.
      **Spec ref**: submit-003 deduplication section

- [x] **Statement** (✗ uncovered): "The deduplication cache retains entries for
      at least 60 seconds." **Covered by**: New step "deduplication cache expiry
      is configured to at least 60 seconds" — reads `message.controller.ts`
      source, finds all `expireIn` values used for dedup cache writes, and
      asserts each is ≥ 60 000 ms (implementation uses 65 000 ms). **Spec ref**:
      submit-003 last bullet

---

### submit-002 — Envelope requests are authenticated with HMAC signatures keyed by envelope kind

File:
[src/requirements/submit/002-submit-hmac-auth.requirement.test.ts](src/requirements/submit/002-submit-hmac-auth.requirement.test.ts)\
Score: 0.80 · Statements: 8 ✓ / 0 ⚠ / 2 ✗

- [x] **Statement** (✗ uncovered): "The server rejects requests that present
      multiple identity headers, or an identity header that does not match the
      envelope `category`, with `E_INVALID_AUTH_HEADERS`." **Add step**:
      `await t.step("rejects envelope with mismatched identity header and category with E_INVALID_AUTH_HEADERS", ...)`
      **Assert**: Message envelope sent with `x-rpp-invitation-id` header (wrong
      kind) returns HTTP 403 with `error.code === "E_INVALID_AUTH_HEADERS"`.
      **Spec ref**: submit-002 bullet 6

- [x] **Statement** (✗ uncovered): "Credential-based authorization failures use
      HTTP 403, not HTTP 401." **Add step**:
      `await t.step("invalid HMAC signature returns HTTP 403 not 401", ...)`
      **Assert**: Request with correct headers but wrong signature returns
      status 403. **Spec ref**: submit-002 last bullet

---

### submit-001 — Servers expose an envelope endpoint

File:
[src/requirements/submit/001-submit-endpoint.requirement.test.ts](src/requirements/submit/001-submit-endpoint.requirement.test.ts)\
Score: 0.67 · Statements: 4 ✓ / 1 ⚠ / 2 ✗

- [x] **Statement** (✗ uncovered): "Invitation envelope response shape:
      `{ ok, accepted, invitation_id }`. If the receiver auto-accepts, MAY
      additionally include the issued `receipt` inline." **Add step**:
      `await t.step("invitation envelope returns correct response schema including optional inline receipt", ...)`
      **Assert**: Successful invitation POST returns body with `ok: true`,
      `accepted: boolean`, `invitation_id: string`; when auto-accepted,
      `receipt` object also present. **Spec ref**: submit-001 Response shapes
      section

- [x] **Statement** (✗ uncovered): "Receipt callback envelope response shape:
      `{ ok, accepted, invitation_id }`." **Add step**:
      `await t.step("receipt callback envelope returns correct response schema", ...)`
      **Assert**: Successful receipt callback POST returns body with `ok: true`,
      `accepted: boolean`, `invitation_id: string`. **Spec ref**: submit-001
      Response shapes section

- [x] **Statement** (⚠ partial — endpoint tested via helper but explicit path
      assertion not present): "The server exposes a POST endpoint at
      `/rpp/v1/envelopes`." **Add step**:
      `await t.step("envelope endpoint is accessible at /rpp/v1/envelopes", ...)`
      **Assert**:
      `fetch(baseUrl + "/rpp/v1/envelopes", { method: "POST", ... })` reaches
      the handler (no 404). **Spec ref**: submit-001 first bullet

---

### messages-001 — Listeners can send messages using a held receipt

File:
[src/requirements/messages/001-send-message.requirement.test.ts](src/requirements/messages/001-send-message.requirement.test.ts)\
Score: 0.75 · Statements: 6 ✓ / 0 ⚠ / 2 ✗

- [x] **Statement** (✗ uncovered): "The server MUST generate a UUIDv7
      `message_id` and ensure `(sender_domain, message_id)` is unique per the
      local sender domain." **Add step**:
      `await t.step("send_message generates a UUIDv7 message_id unique per sender_domain", ...)`
      **Assert**: Returned `message_id` passes UUIDv7 format check (version
      nibble = 7); a second `send_message` call returns a different
      `message_id`. **Spec ref**: messages-001 bullet 11

- [x] **Statement** (✗ uncovered): "If the message body exceeds 256 KB, the tool
      MUST reject the call locally with `E_MESSAGE_TOO_LARGE`." **Add step**:
      `await t.step("send_message rejects body content exceeding 256 KB with E_MESSAGE_TOO_LARGE", ...)`
      **Assert**: `body.content` set to `"x".repeat(300 * 1024)` yields
      `error.code === "E_MESSAGE_TOO_LARGE"`. **Spec ref**: messages-001 last
      bullet

---

### mcp-001 — Tools use structured output with outputSchema

File:
[src/requirements/mcp/001-tool-output-format.requirement.test.ts](src/requirements/mcp/001-tool-output-format.requirement.test.ts)\
Score: 0.80 · Statements: 4 / 0 / 1

- [x] **Statement** (✗ uncovered): "Tool handlers SHOULD use the shared
      `toolResult()` helper from `src/tools/tool-result.ts` to produce both
      `structuredContent` and the text fallback from a single data object."
      **Add step**:
      `await t.step("all tool handlers invoke the toolResult() helper for output formatting", ...)`
      **Assert**: `grep -r "toolResult(" src/tools/` finds at least one call per
      tool file; or a static analysis step confirms no tool returns raw objects
      without `toolResult()`. **Spec ref**: mcp-001 Rationale section

---

### invitations-006 — Senders can attach verified and custom claims to outgoing invitations

File:
[src/requirements/invitations/006-send-invitation-claims.requirement.test.ts](src/requirements/invitations/006-send-invitation-claims.requirement.test.ts)\
Score: 0.80 · Statements: 5 ✓ / 0 ⚠ / 1 ✗

- [x] **Statement** (✗ uncovered): "If none of the inputs yield any claim data,
      the `claims` field is absent or an empty object in the envelope." **Add
      step**:
      `await t.step("invite_contact succeeds when no claims data is available from any source", ...)`
      **Assert**: `invite_contact` called with no `custom_claims` and an account
      with no `user_verified_fields` produces a valid invitation; envelope sent
      to receiver has absent or empty `claims`. **Spec ref**: invitations-006
      Expected Behavior, last bullet

---

### contacts-002 — Contact field accumulation from invitation claims

File:
[src/requirements/contacts/002-contact-field-accumulation.requirement.test.ts](src/requirements/contacts/002-contact-field-accumulation.requirement.test.ts)\
Score: 0.80 · Statements: 5 ✓ / 0 ⚠ / 1 ✗

- [x] **Statement** (✗ uncovered): "`get_contact` MUST return the full `fields`
      history (all `ContactFieldRecord` entries per key, not just the most
      recent)." **Add step**:
      `await t.step("get_contact returns full field history array for each key", ...)`
      **Assert**: After two invitations from the same sender with different
      values for the same claim key, `get_contact` response `fields[key]` is an
      array with 2 entries. **Spec ref**: contacts-002 rule 5

---

### contacts-001 — Contact auto-creation on invitation acceptance

File:
[src/requirements/contacts/001-contact-auto-creation.requirement.test.ts](src/requirements/contacts/001-contact-auto-creation.requirement.test.ts)\
Score: 0.80 · Statements: 5 ✓ / 0 ⚠ / 1 ✗

- [x] **Statement** (✗ uncovered): "If the invitation has no
      `claims.immutable.domain_id`, no contact is created." **Add step**:
      `await t.step("accepting invitation without domain_id does not create a contact", ...)`
      **Assert**: Accept invitation seeded without `claims.immutable.domain_id`;
      `list_contacts` returns empty array. **Spec ref**: contacts-001 rule 7

---

### mcp-auth-008 — MCP endpoint validates Origin header

File:
[src/requirements/mcp/auth/008-origin-validation.requirement.test.ts](src/requirements/mcp/auth/008-origin-validation.requirement.test.ts)\
Score: 0.50 · Statements: 0 ✓ / 2 ⚠ / 0 ✗

- [x] **Statement** (⚠ partial — needs explicit rejection test): "Requests with
      disallowed or malformed origins MUST be rejected." **Add step**:
      `await t.step("rejects MCP request with disallowed Origin header", ...)`
      **Assert**: POST to MCP endpoint with `Origin: https://evil.example`
      returns HTTP 403 (or 400). **Spec ref**: mcp-auth-008 Expected behavior
      bullet 1

- [x] **Statement** (⚠ partial — needs explicit test for ordering): "Origin
      validation is enforced before sensitive MCP operations execute." **Add
      step**:
      `await t.step("Origin is validated before any tool handler executes", ...)`
      **Assert**: Request with disallowed Origin + valid bearer token returns
      403 without executing the tool (tool-side KV state unchanged). **Spec
      ref**: mcp-auth-008 Expected behavior bullet 3

---

### domain-admin-013 — Domain identity includes port when non-standard

File:
[src/requirements/domain-admin/013-domain-identity-port.requirement.test.ts](src/requirements/domain-admin/013-domain-identity-port.requirement.test.ts)\
Score: 0.75 · Statements: 2 ✓ / 2 ⚠ / 0 ✗

- [x] **Statement** (⚠ partial — port present in test output but exact `:PORT`
      suffix assertion may be missing): "A server started on `localhost:8000`
      exposes a domain identity of `localhost:8000`." **Add step**:
      `await t.step("domain identity equals localhost:PORT for non-standard port", ...)`
      **Assert**:
      `assertEquals(domainIdentity.domain, \`localhost:${port}\`)`where`port !==
      443`. **Spec ref**: domain-admin-013 Expected behavior, rule 1

- [x] **Statement** (⚠ partial — standard-port exclusion case not covered): "A
      server on port 443 exposes a domain identity of `example.com` (no port
      suffix)." **Add step**:
      `await t.step("domain identity omits port suffix when port is 443", ...)`
      **Assert**: With `RPP_DOMAIN=example.com` and port 443 configured, domain
      identity is `"example.com"` (no `:443`). **Spec ref**: domain-admin-013
      Expected behavior, rule 2

---

### domain-admin-010 — Domain administrators can remove admin verified metadata

File:
[src/requirements/domain-admin/010-remove-admin-verified-metadata.requirement.test.ts](src/requirements/domain-admin/010-remove-admin-verified-metadata.requirement.test.ts)\
Score: 0.50 · Statements: 1 ✓ / 1 ⚠ / 1 ✗

- [x] **Statement** (✗ uncovered): "The system reconciles invitation
      verification state after field removal (subsequent invitations no longer
      carry the removed field)." **Add step**:
      `await t.step("subsequent invitation after field removal does not carry the removed admin-verified field", ...)`
      **Assert**: After `remove_admin_verified_metadata`, `invite_contact`
      produces an envelope whose `claims.admin` does not include the removed
      key. **Spec ref**: domain-admin-010 Expected behavior bullet 3

- [x] **Statement** (⚠ partial — removal tested but merged view recalculation
      not explicitly verified): "After removal, the effective view returned by
      `get_user_verified_metadata` no longer includes that field." **Add step**:
      `await t.step("get_user_verified_metadata does not include field after admin removal", ...)`
      **Assert**: After `remove_admin_verified_metadata`, calling
      `get_user_verified_metadata` for the same user omits the removed key
      entirely. **Spec ref**: domain-admin-010 Expected behavior bullet 2

---

### domain-admin-006 — Domain administrators can delete archived verification keys

File:
[src/requirements/domain-admin/006-delete-historical-key.requirement.test.ts](src/requirements/domain-admin/006-delete-historical-key.requirement.test.ts)\
Score: 0.50 · Statements: 0 ✓ / 1 ⚠ / 1 ✗

- [x] **Statement** (✗ uncovered): "Deleting a key makes prior attestations
      signed by that key unverifiable." **Add step**:
      `await t.step("attestation signed by deleted key fails verification", ...)`
      **Assert**: Invitation signed with the now-deleted key is rejected;
      verification error references the missing key. **Spec ref**:
      domain-admin-006 Expected behavior bullet 2

- [x] **Statement** (⚠ partial — deletion confirmed but impact on in-flight
      verification not tested): "The active key cannot be deleted; only archived
      (rotated-out) keys can be removed." **Add step**:
      `await t.step("attempting to delete the active key returns an error", ...)`
      **Assert**: `delete_historical_key` called with the current active key ID
      returns `error.code === "E_KEY_NOT_FOUND"` or equivalent protection error.
      **Spec ref**: domain-admin-006 Expected behavior bullet 1

---

### deployment-001 — Single-Tenant-Per-Instance Deployment

File:
[src/requirements/deployment/001-single-tenant-per-instance.requirement.test.ts](src/requirements/deployment/001-single-tenant-per-instance.requirement.test.ts)\
Score: 0.67 · Statements: 1 ✓ / 2 ⚠ / 0 ✗

- [x] **Statement** (⚠ partial — single-domain isolation implied but
      two-instance test not present): "Each domain's instance has isolated KV
      storage (cannot read/write another domain's data)." **Add step**:
      `await t.step("two server instances have isolated KV storage", ...)`
      **Assert**: Start two servers with separate `kvPath` values; data written
      to server A is not returned by server B for the same key. **Spec ref**:
      deployment-001 Testing section

- [ ] **Statement** (⚠ partial — auth scoping per-instance implied but
      cross-instance token test not present): "A token for domain A cannot
      access domain B's MCP tools." **Add step**:
      `await t.step("token issued for domain A is rejected by domain B instance", ...)`
      **Assert**: Token with `aud: "https://domainA.example"` returns 401 on
      domain B instance (different audience). **Spec ref**: deployment-001
      Testing section

---

### invitations-003 — Listeners can accept a pending invitation

File:
[src/requirements/invitations/003-accept-invitation.requirement.test.ts](src/requirements/invitations/003-accept-invitation.requirement.test.ts)\
Score: 0.75 · Statements: 5 ✓ / 2 ⚠ / 0 ✗

- [x] **Statement** (⚠ partial — acceptance tested but narrower terms
      negotiation not isolated): "Acceptance MAY use narrower terms than
      proposed, following Section 9.3." **Add step**:
      `await t.step("accept_invitation with narrower terms issues receipt for only accepted subset", ...)`
      **Assert**: Invite proposes `{ category: ["billing", "correspondence"] }`;
      acceptance with `{ category: ["billing"] }` only issues one receipt for
      `billing`. **Spec ref**: invitations-003 bullet 7

- [ ] **Statement** (⚠ partial — single receipt per acceptance tested but
      multi-category receipt issuance not isolated): "If multiple categories are
      accepted, the server issues one receipt per accepted category." **Add
      step**:
      `await t.step("accepting multi-category invitation issues one receipt per category", ...)`
      **Assert**: Invitation with
      `proposed_terms.category: ["billing", "correspondence"]` accepted in full
      returns response with two `receipt` objects. **Spec ref**: invitations-003
      bullet 8

---

### well-known-001 — Domain identity well-known endpoint

File:
[src/requirements/well-known-paths.requirement.test.ts](src/requirements/well-known-paths.requirement.test.ts)\
Score: 0.70 · Statements: 3 ✓ / 2 ⚠ / 0 ✗

- [ ] **Statement** (⚠ partial — required fields tested; optional `domain_type`
      not covered): "The response MAY include `domain_type` — one of `personal`,
      `business`, `academic`, `government`, `nonprofit`, `healthcare`, `media`."
      **Add step**:
      `await t.step("well-known endpoint includes domain_type when configured", ...)`
      **Assert**: With `RPP_DOMAIN_TYPE=business` set,
      `.well-known/rpp-domain-identity` JSON includes `domain_type: "business"`.
      **Spec ref**: well-known-001 MAY field definitions

- [x] **Statement** (⚠ partial — required fields tested; optional `public_key`
      not covered): "The response MAY include `public_key` with
      `algorithm: \"Ed25519\"` and Base64-encoded SPKI `key`." **Add step**:
      `await t.step("well-known endpoint includes public_key with Ed25519 algorithm when configured", ...)`
      **Assert**: When domain has a verification key,
      `.well-known/rpp-domain-identity` includes
      `public_key.algorithm === "Ed25519"` and `public_key.key` is a non-empty
      Base64 string. **Spec ref**: well-known-001 MAY field definitions

---

### messages-007 — Message metadata field is stored and returned

File:
[src/requirements/messages/007-metadata.requirement.test.ts](src/requirements/messages/007-metadata.requirement.test.ts)\
Score: 0.81 · Statements: 6 ✓ / 1 ⚠ / 1 ✗

- [ ] **Statement** (⚠ partial — tool-layer rejection not isolated from HTTP layer): "`send_message` MUST accept an optional `metadata` parameter and include it in the outbound envelope when provided." **Add step**:
      `await t.step("send_message metadata parameter is forwarded in the outbound envelope", ...)`
      **Assert**: Call `send_message` with a `metadata` object via MCP tool; inspect the stored message record to confirm `metadata` was included in the envelope sent to the submit endpoint. **Spec ref**: messages-007 §Behavior, bullet 3

- [ ] **Statement** (✗ uncovered): "The server MUST NOT interpret or act on `metadata` contents." **Add step**:
      `await t.step("server does not alter metadata contents (round-trip preserves original value)", ...)`
      **Assert**: Store a message with `metadata: { "key": "arbitrary-value" }`; retrieve via `get_message` and assert the metadata field equals the original object exactly (no normalisation or additional fields). **Spec ref**: messages-007 §Behavior, bullet 5

---

## Missing test files

The following requirements have no corresponding test file. All statements score 0.0.

### invitations-009 — Senders can cancel a direct invitation they have sent

File: `src/requirements/invitations/009-cancel-invitation.requirement.test.ts` (does not exist)\
Score: 0.00 · Statements: 0 ✓ / 0 ⚠ / 5 ✗

- [ ] **Statement** (✗ uncovered): "Only the originating sender (identified by OID) MAY cancel the invitation. Attempts by any other account MUST return a structured not-found error (the server MUST NOT distinguish 'not yours' from 'does not exist')." **Add step**: `await t.step("cancel_invitation by non-owner returns not-found error", ...)` **Spec ref**: invitations-009 §Authorization

- [ ] **Statement** (✗ uncovered): "The tool MUST accept cancellation of invitations in `pending` OR `accepted` state." **Add step**: `await t.step("cancel_invitation succeeds for pending and accepted invitations", ...)` **Spec ref**: invitations-009 §Allowed states

- [ ] **Statement** (✗ uncovered): "If the invitation is already in a terminal state (`rejected`, `cancelled`, `expired`), the tool MUST return a structured error indicating the invitation cannot be cancelled in its current state." **Add step**: `await t.step("cancel_invitation on terminal state invitation returns structured error", ...)` **Spec ref**: invitations-009 §Terminal state guard

- [ ] **Statement** (✗ uncovered): "On success: The invitation status MUST be set to `cancelled`. All receipts derived from that invitation MUST be immediately invalidated (revoked with reason `SUPERSEDED`)." **Add step**: `await t.step("cancel_invitation sets status to cancelled and revokes all derived receipts", ...)` **Spec ref**: invitations-009 §Success effects

- [ ] **Statement** (✗ uncovered): "The tool MUST return the updated invitation record including the new `cancelled` status." **Add step**: `await t.step("cancel_invitation returns updated record with cancelled status", ...)` **Spec ref**: invitations-009 §Response shape

---
