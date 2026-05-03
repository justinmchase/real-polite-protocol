# Semantic Closure Evaluation Report

**Scope**: all\
**Generated**: 2026-05-03\
**Methodology**: Statement-level semantic scoring — 1.0 covered · 0.5 partial ·
0.0 uncovered\
**How to use this report**: Each unchecked box in § Action Items represents one
missing or weak test step. Work top-to-bottom; mark `[x]` when the corresponding
test step has been added and is passing.

> **Note**: 30 of 78 requirements have no extractable normative statements (the
> requirement doc uses prose or test-step-only description rather than
> MUST/SHOULD bullet points). These requirements score 1.00 when test steps are
> present; their statement count contributes 0 to both numerator and denominator
> of the statement-weighted metric.

---

## Overall

| Metric                                      | Score                 |
| ------------------------------------------- | --------------------- |
| Requirements fully covered (≥ 0.80)         | 65 / 78 (83.3%)       |
| Requirements partially covered (0.40–0.79)  | 12 / 78 (15.4%)       |
| Requirements with no covered steps (< 0.40) | 1 / 78 (1.3%)         |
| **Statement-weighted coverage**             | **133 / 148 = 89.9%** |

---

## By Category

_(Ordered by ascending stmt-wt% to highlight weakest areas first.)_

| Category         | Reqs | Stmts | Stmt-wt% | Covered ≥0.80 | Partial 0.40–0.79 | Uncovered |
| ---------------- | ---- | ----- | -------- | ------------- | ----------------- | --------- |
| mcp              | 14   | 18    | 79.6%    | 11            | 2                 | 1         |
| invitations      | 9    | 25    | 85.9%    | 6             | 3                 | 0         |
| account          | 10   | 21    | 86.6%    | 6             | 4                 | 0         |
| receptive-policy | 7    | 16    | 90.7%    | 5             | 2                 | 0         |
| messages         | 7    | 38    | 91.5%    | 6             | 1                 | 0         |
| domain-admin     | 13   | 4     | 100%     | 13            | 0                 | 0         |
| receipts         | 4    | 4     | 100%     | 4             | 0                 | 0         |
| submit           | 4    | 8     | 100%     | 4             | 0                 | 0         |
| well-known       | 1    | 14    | 100%     | 1             | 0                 | 0         |
| contacts         | 7    | 0     | —        | 7             | 0                 | 0         |
| kv-path          | 1    | 0     | —        | 1             | 0                 | 0         |
| startup          | 1    | 0     | —        | 1             | 0                 | 0         |

---

## By Requirement

| ID                   | Title                                                           | Score | Stmts (✓ / ⚠ / ✗) | Notes                                                     |
| -------------------- | --------------------------------------------------------------- | ----- | ----------------- | --------------------------------------------------------- |
| account-001          | Account is the server-local identity                            | 0.50  | 0 / 1 / 0         | 1 statement needs additional coverage                     |
| account-002          | Account is auto-provisioned on first authenticated MCP request  | 1.00  | 2 / 0 / 0         | fully covered                                             |
| account-003          | Account MAY have an optional display name                       | 0.67  | 2 / 1 / 1         | 2 statements need coverage                                |
| account-004          | All MCP tool operations are scoped to the authenticated account | 1.00  | 2 / 0 / 0         | fully covered                                             |
| account-005          | Domain tools require domain.admin role from token roles claim   | 1.00  | 2 / 0 / 0         | fully covered                                             |
| account-006          | Permission introspection tool                                   | 0.50  | 0 / 1 / 0         | 1 statement needs additional coverage                     |
| account-007          | User set verified metadata                                      | 0.50  | 0 / 1 / 0         | 1 statement needs additional coverage                     |
| account-008          | Domain ID assignment                                            | 1.00  | 2 / 0 / 0         | fully covered                                             |
| account-009          | Domain ID admin claim                                           | 1.00  | 4 / 0 / 0         | fully covered                                             |
| account-010          | Domain ID on invitations                                        | 1.00  | 2 / 0 / 0         | fully covered                                             |
| contacts-001         | Contact auto-creation                                           | 1.00  | —                 | fully covered                                             |
| contacts-002         | Contact field accumulation                                      | 1.00  | —                 | fully covered                                             |
| contacts-003         | List contacts                                                   | 1.00  | —                 | fully covered                                             |
| contacts-004         | Get contact                                                     | 1.00  | —                 | fully covered                                             |
| contacts-005         | Delete contact                                                  | 1.00  | —                 | fully covered                                             |
| contacts-006         | Invite via policy or receipt                                    | 1.00  | —                 | fully covered                                             |
| contacts-007         | Set contact field                                               | 1.00  | —                 | fully covered                                             |
| domain-admin-001     | Domain admin permissions                                        | 1.00  | —                 | fully covered                                             |
| domain-admin-002     | Update domain identity                                          | 1.00  | —                 | fully covered                                             |
| domain-admin-003     | Get verification key                                            | 1.00  | —                 | fully covered                                             |
| domain-admin-004     | Rotate verification key                                         | 1.00  | —                 | fully covered                                             |
| domain-admin-005     | List historical keys                                            | 1.00  | —                 | fully covered                                             |
| domain-admin-006     | Delete historical key                                           | 1.00  | —                 | fully covered                                             |
| domain-admin-007     | List verifiable users                                           | 1.00  | —                 | fully covered                                             |
| domain-admin-008     | Get user verified metadata                                      | 1.00  | —                 | fully covered                                             |
| domain-admin-009     | Set admin verified metadata                                     | 1.00  | 2 / 0 / 0         | fully covered                                             |
| domain-admin-010     | Remove admin verified metadata                                  | 1.00  | —                 | fully covered                                             |
| domain-admin-011     | Get contact policy URL                                          | 1.00  | —                 | fully covered                                             |
| domain-admin-012     | Set contact policy URL                                          | 1.00  | —                 | fully covered                                             |
| domain-admin-013     | Domain identity port normalization                              | 1.00  | 2 / 0 / 0         | fully covered                                             |
| invitations-001      | List invitations                                                | 1.00  | —                 | fully covered                                             |
| invitations-002      | Review invitation                                               | 1.00  | —                 | fully covered                                             |
| invitations-003      | Accept invitation                                               | 1.00  | 3 / 0 / 0         | fully covered                                             |
| invitations-004      | Reject invitation                                               | 1.00  | 3 / 0 / 0         | fully covered                                             |
| invitations-005      | Send invitation                                                 | 1.00  | 3 / 0 / 0         | fully covered                                             |
| invitations-006      | Send invitation claims                                          | 0.71  | 4 / 2 / 1         | 3 statements need coverage                                |
| invitations-007      | Receipt callback delivery                                       | 0.50  | 1 / 0 / 1         | 2 statements need coverage                                |
| invitations-008      | Receipt callback handler                                        | 0.75  | 1 / 1 / 0         | 1 statement needs additional coverage                     |
| invitations-009      | Cancel invitation                                               | 1.00  | 5 / 0 / 0         | fully covered                                             |
| config-001           | KV path configuration                                           | 1.00  | —                 | fully covered                                             |
| mcp-001              | Tool output format                                              | 0.67  | 3 / 2 / 1         | 3 statements need coverage                                |
| mcp-002              | Tool list                                                       | 0.83  | 5 / 1 / 0         | fully covered                                             |
| mcp-003              | Stateless transport                                             | 1.00  | 5 / 0 / 0         | fully covered                                             |
| mcp-auth-001         | Auth discovery endpoint                                         | 1.00  | —                 | fully covered                                             |
| mcp-auth-002         | Bearer token requirement                                        | 1.00  | —                 | fully covered                                             |
| mcp-auth-003         | Bearer token per-request scope                                  | 1.00  | —                 | fully covered                                             |
| mcp-auth-004         | Token validation                                                | 1.00  | —                 | fully covered                                             |
| mcp-auth-005         | Token forwarding prohibition                                    | 1.00  | —                 | fully covered                                             |
| mcp-auth-006         | OAuth metadata publication                                      | 1.00  | —                 | fully covered                                             |
| mcp-auth-007         | Unauthorized challenge metadata                                 | 0.00  | —                 | test file has no test steps — see § Missing test coverage |
| mcp-auth-008         | Origin validation                                               | 1.00  | —                 | fully covered                                             |
| mcp-auth-009         | HTTPS transport                                                 | 1.00  | —                 | fully covered                                             |
| mcp-auth-010         | Error statuses                                                  | 0.50  | 0 / 1 / 0         | 1 statement needs additional coverage                     |
| mcp-auth-011         | Canonical resource indicator                                    | 1.00  | —                 | fully covered                                             |
| messages-001         | Send message                                                    | 0.88  | 7 / 1 / 0         | fully covered                                             |
| messages-002         | List messages                                                   | 1.00  | 5 / 0 / 0         | fully covered                                             |
| messages-003         | Get message                                                     | 1.00  | 3 / 0 / 0         | fully covered                                             |
| messages-004         | Mark read                                                       | 1.00  | 3 / 0 / 0         | fully covered                                             |
| messages-005         | Delete message                                                  | 0.75  | 3 / 1 / 1         | 2 statements need coverage                                |
| messages-006         | Sender claims                                                   | 0.83  | 5 / 1 / 0         | fully covered                                             |
| messages-007         | Message metadata                                                | 1.00  | 8 / 0 / 0         | fully covered                                             |
| receipts-001         | Issue receipt on acceptance                                     | 1.00  | 1 / 0 / 0         | fully covered                                             |
| receipts-002         | List issued receipts                                            | 1.00  | —                 | fully covered                                             |
| receipts-003         | Revoke receipt                                                  | 1.00  | 3 / 0 / 0         | fully covered                                             |
| receipts-004         | Receipt superseding                                             | 1.00  | —                 | fully covered                                             |
| receptive-policy-001 | Get receptive policy                                            | 0.50  | 0 / 1 / 0         | 1 statement needs additional coverage                     |
| receptive-policy-002 | Set receptive policy                                            | 0.67  | 1 / 2 / 0         | 2 statements need additional coverage                     |
| receptive-policy-003 | Open receptive window                                           | 1.00  | 3 / 0 / 0         | fully covered                                             |
| receptive-policy-004 | Contact receptive policy                                        | 1.00  | —                 | fully covered                                             |
| receptive-policy-005 | Receipt receptive policy                                        | 1.00  | —                 | fully covered                                             |
| receptive-policy-006 | Remove receptive policy                                         | 1.00  | —                 | fully covered                                             |
| receptive-policy-007 | Receptive window shortcode                                      | 1.00  | 9 / 0 / 0         | fully covered                                             |
| startup-001          | Server startup                                                  | 1.00  | —                 | fully covered                                             |
| submit-001           | Submit endpoint response shapes                                 | 1.00  | 1 / 0 / 0         | fully covered                                             |
| submit-002           | Submit HMAC authentication                                      | 1.00  | 1 / 0 / 0         | fully covered                                             |
| submit-003           | Submit replay protection                                        | 1.00  | —                 | fully covered                                             |
| submit-004           | Submit envelope validation                                      | 1.00  | 6 / 0 / 0         | fully covered                                             |
| well-known-001       | Domain identity well-known endpoint                             | 1.00  | 14 / 0 / 0        | fully covered                                             |

---

## Action Items

_(Categories ordered by ascending stmt-wt% — weakest areas first.)_

### mcp — 79.6% stmt-wt

#### mcp-auth-010 — Error statuses

File:
[src/requirements/mcp/auth/010-error-statuses.requirement.test.ts](src/requirements/mcp/auth/010-error-statuses.requirement.test.ts)\
Score: 0.50 · Statements: 0 ✓ / 1 ⚠ / 0 ✗

- [ ] **Statement** (⚠ partial — HTTP status codes tested but the
      machine-readable `E_`-prefixed error code in the response body is not
      verified): "Authentication and authorization error codes are
      machine-readable and MUST use the `E_` prefix defined in the RFC MCP code
      registry." **Add step**:
      `await t.step("auth error response body contains an E_-prefixed error code", ...)`
      **Assert**: POST `/mcp` with a missing or invalid `Authorization` header;
      parse the JSON response body; assert `body.error.code` (or the equivalent
      field per the MCP error envelope) starts with `"E_"` (e.g.
      `"E_UNAUTHORIZED"`, `"E_INVALID_TOKEN"`). **Spec ref**: mcp-auth-010
      §Behavior, bullet 1.

---

#### mcp-001 — Tool output format

File:
[src/requirements/mcp/001-tool-output-format.requirement.test.ts](src/requirements/mcp/001-tool-output-format.requirement.test.ts)\
Score: 0.67 · Statements: 3 ✓ / 2 ⚠ / 1 ✗

- [ ] **Statement** (⚠ partial — `structuredContent` presence tested but
      `outputSchema` declaration on the tool entry not verified): "Tools MUST
      declare an `outputSchema` using a zod schema that describes the structure
      of the result." **Add step**:
      `await t.step("tools/list response includes outputSchema for each tool", ...)`
      **Assert**: send a `tools/list` MCP request; iterate `result.tools`;
      assert every entry has a non-null `outputSchema` property. **Spec ref**:
      mcp-001 §Behavior, bullet 1.

- [ ] **Statement** (✗ uncovered): "Tools MUST be registered via `registerTool`
      (not the deprecated `.tool()` method)." **Add step**:
      `await t.step("tool registration uses registerTool not the deprecated tool method", ...)`
      **Assert**: audit `src/tools/` source — grep for `.tool(` calls and assert
      zero results; or call `initialize` and verify no deprecation warning
      appears in the server log. This constraint is best enforced as a lint/grep
      assertion in the test. **Spec ref**: mcp-001 §Behavior, bullet 4.

- [ ] **Statement** (⚠ partial — `structuredContent` always present but explicit
      check that no text-only result is returned without a structured
      counterpart is missing): "Tools MUST NOT return raw unstructured text when
      the result is structured data." **Add step**:
      `await t.step("tool result content array never contains a text-only item without a corresponding structuredContent", ...)`
      **Assert**: call several tools; for each response, assert that
      `result.content` does not consist solely of `{ type: "text" }` items
      without a matching `result.structuredContent` field. **Spec ref**: mcp-001
      §Behavior, bullet 5.

---

### invitations — 85.9% stmt-wt

#### invitations-006 — Send invitation claims

File:
[src/requirements/invitations/006-send-invitation-claims.requirement.test.ts](src/requirements/invitations/006-send-invitation-claims.requirement.test.ts)\
Score: 0.71 · Statements: 4 ✓ / 2 ⚠ / 1 ✗

- [ ] **Statement** (⚠ partial — custom claims included verbatim but they are
      not explicitly labelled as unverified in the envelope): "`custom` claims
      are caller-supplied. They MUST be clearly distinguished as unverified.
      Receivers MUST NOT treat them as authoritative." **Add step**:
      `await t.step("invitation envelope places custom claims under a clearly unverified key distinct from user and admin", ...)`
      **Assert**: include `custom_claims: { greeting: "hello" }` in a
      `send_invitation` call; assert the resulting envelope JSON has
      `claims.custom.greeting === "hello"` at a key (`custom`) that is distinct
      from `claims.user` and `claims.admin`, making the unverified origin
      unambiguous to receivers. **Spec ref**: invitations-006 §Behavior,
      bullet 3.

- [ ] **Statement** (⚠ partial — server-side value resolution tested but
      fabricated value injection path not explicitly closed): "The caller MUST
      NOT be able to supply fabricated `user` or `admin` values directly; only
      keys are accepted as input, and the server is the sole source of the
      corresponding values." **Add step**:
      `await t.step("send_invitation input schema accepts only claim keys not claim values for user and admin", ...)`
      **Assert**: attempt to call `send_invitation` with a payload that includes
      arbitrary `user` or `admin` value maps; assert a Zod validation error is
      returned (the tool schema must not accept those fields at all). **Spec
      ref**: invitations-006 §Behavior, bullet 5.

- [ ] **Statement** (✗ uncovered): "`user` and `admin` values originate
      exclusively from the server's own verified metadata store — the caller
      selects which keys to expose, but MUST NOT supply or override the values."
      **Add step**:
      `await t.step("invitation envelope user claim values match stored user_verified_fields not caller-supplied data", ...)`
      **Assert**: pre-store a known value via `set_user_verified_metadata`; call
      `send_invitation` with `include_user_claims: ["<stored_key>"]`; assert the
      envelope's `claims.user.<stored_key>` equals the stored value exactly (not
      any value the caller could have injected). **Spec ref**: invitations-006
      §Behavior, bullet 6.

---

#### invitations-007 — Receipt callback delivery

File:
[src/requirements/invitations/007-receipt-callback-delivery.requirement.test.ts](src/requirements/invitations/007-receipt-callback-delivery.requirement.test.ts)\
Score: 0.50 · Statements: 1 ✓ / 0 ⚠ / 1 ✗

- [ ] **Statement** (✗ uncovered): "The `delivery.token` is single-use and MUST
      NOT be sent on any subsequent request after the inviting domain confirms
      acceptance with HTTP 202." **Add step**:
      `await t.step("delivery token is rejected on second use after successful 202 acceptance", ...)`
      **Assert**: submit a receipt callback with a valid `delivery.token` that
      returns 202; submit the identical callback again with the same token;
      assert the second call returns a structured error with code
      `E_DELIVERY_TOKEN_CONSUMED`. **Spec ref**: invitations-007 §Behavior,
      bullet 1.

- [ ] **Statement** (✗ uncovered): "Auto-accept inline optimization (Section
      7.4, Section 9.7.5) MAY return the receipt synchronously in the original
      invitation submission's response body in lieu of a separate callback
      request; in that case no out-of-band callback is sent." **Add step**:
      `await t.step("send_invitation returns receipt inline when receiver auto-accepts without out-of-band callback", ...)`
      **Assert**: configure the mock receiver to return `200` with a receipt
      object inline; call `send_invitation`; assert the tool result contains the
      receipt and that no separate POST callback was sent to the mock callback
      server. **Spec ref**: invitations-007 §Behavior, bullet 2 (auto-accept
      path, Section 9.7.5).

---

#### invitations-008 — Receipt callback handler

File:
[src/requirements/invitations/008-receipt-callback-handler.requirement.test.ts](src/requirements/invitations/008-receipt-callback-handler.requirement.test.ts)\
Score: 0.75 · Statements: 1 ✓ / 1 ⚠ / 0 ✗

- [ ] **Statement** (⚠ partial — acceptance transition tested but
      receipt-superseding semantics not exercised): "On
      `decision: \"accepted\"`: ... The handler MUST trigger receipt-superseding
      semantics (`receipts-004`) if applicable." **Add step**:
      `await t.step("receipt callback with accepted decision supersedes any prior receipt from the same sender domain", ...)`
      **Assert**: accept an initial invitation to establish a relationship and
      produce a first receipt; send a second invitation from the same domain;
      accept it via the receipt callback; assert the first receipt is now
      superseded (no longer active or replaced by the new one). **Spec ref**:
      invitations-008 §Behavior, bullet 1 (superseding clause), `receipts-004`.

---

### account — 86.6% stmt-wt

#### account-001 — Account is the server-local identity for an authenticated listener

File:
[src/requirements/account/001-account-identity.requirement.test.ts](src/requirements/account/001-account-identity.requirement.test.ts)\
Score: 0.50 · Statements: 0 ✓ / 1 ⚠ / 0 ✗

- [ ] **Statement** (⚠ partial — stable account ID tested via OID but the
      explicit "display name not required" guard is not a named test step): "The
      server MUST NOT require a display name as a condition of having an account
      (Section 3A.2)." **Add step**:
      `await t.step("account creation succeeds and returns a stable account id when no display name is provided", ...)`
      **Assert**: make an authenticated MCP call without any `display_name`
      field; assert a valid `account_id` is returned (not a validation error
      demanding a display name). **Spec ref**: account-001 §Behavior, bullet 1.

---

#### account-003 — Account MAY have an optional display name

File:
[src/requirements/account/003-account-display-name.requirement.test.ts](src/requirements/account/003-account-display-name.requirement.test.ts)\
Score: 0.67 · Statements: 2 ✓ / 1 ⚠ / 1 ✗

- [ ] **Statement** (⚠ partial — absence of display name tested but the
      256-code-point upper bound is not probed): "A display name MAY be any
      Unicode string up to 256 code points (Section 3A.2)." **Add step**:
      `await t.step("set_display_name accepts a 256-code-point Unicode string and rejects a 257-code-point string", ...)`
      **Assert**: call `set_display_name` with a 256-character Unicode string
      (e.g. `"a".repeat(256)`); assert success. Repeat with 257 code points;
      assert a structured validation error. **Spec ref**: account-003 §Behavior,
      bullet 1.

- [ ] **Statement** (✗ uncovered): "The listener MAY set or clear their display
      name at any time via the `set_display_name` MCP tool (Section 10B.6)."
      **Add step**:
      `await t.step("set_display_name tool stores a display name and null clears it", ...)`
      **Assert**: call `set_display_name` with a non-null name string; verify
      the stored account reflects it; call `set_display_name` with `null`;
      verify `display_name` is absent or null on subsequent retrieval. **Spec
      ref**: account-003 §Behavior, bullet 3.

- [ ] **Statement** (✗ uncovered): "The listener MAY retrieve their current
      display name via the `get_display_name` MCP tool (Section 10B.6)." **Add
      step**:
      `await t.step("get_display_name tool returns the display name previously stored for the calling account", ...)`
      **Assert**: set a known display name via `set_display_name`; call
      `get_display_name`; assert the response contains the exact string that was
      set. **Spec ref**: account-003 §Behavior, bullet 4.

---

#### account-006 — Permission introspection tool

File:
[src/requirements/account/006-permission-introspection-tool.requirement.test.ts](src/requirements/account/006-permission-introspection-tool.requirement.test.ts)\
Score: 0.50 · Statements: 0 ✓ / 1 ⚠ / 0 ✗

- [ ] **Statement** (⚠ partial — role-based output tested but the "no arbitrary
      identifier input" guard is not isolated as its own assertion): "The tool
      MUST NOT accept arbitrary account identifiers for lookup." **Add step**:
      `await t.step("get_permissions result is always scoped to the calling account regardless of any identifier in the arguments", ...)`
      **Assert**: call `get_permissions` with an extra argument containing
      another user's OID or account ID (if the schema allows it); assert the
      result reflects only the calling account's permissions, not the injected
      identifier's. **Spec ref**: account-006 §Behavior, bullet 1.

---

#### account-007 — User set verified metadata

File:
[src/requirements/account/007-user-set-verified-metadata.requirement.test.ts](src/requirements/account/007-user-set-verified-metadata.requirement.test.ts)\
Score: 0.50 · Statements: 0 ✓ / 1 ⚠ / 0 ✗

- [ ] **Statement** (⚠ partial — admin field preservation checked via "preserves
      admin overrides" step but not isolated as an explicit mutability guard):
      "The tool MUST NOT modify `admin_verified_fields`." **Add step**:
      `await t.step("set_user_verified_metadata does not modify admin_verified_fields even for overlapping keys", ...)`
      **Assert**: pre-populate `admin_verified_fields` via a domain-admin call;
      call `set_user_verified_metadata` with overlapping key names; retrieve the
      account; assert `admin_verified_fields` retains the original admin-set
      values unchanged. **Spec ref**: account-007 §Behavior, bullet 1.

---

### receptive-policy — 90.7% stmt-wt

#### receptive-policy-001 — Get receptive policy

File:
[src/requirements/receptive-policy/001-get-receptive-policy.requirement.test.ts](src/requirements/receptive-policy/001-get-receptive-policy.requirement.test.ts)\
Score: 0.50 · Statements: 0 ✓ / 1 ⚠ / 0 ✗

- [ ] **Statement** (⚠ partial — list scoping tested but receipt-mode exclusion
      from the default result set is not verified): "`mode: \"receipt\"`
      policies (auto-created on invitation acceptance) are **excluded** from the
      default result set to avoid clutter. Callers MUST pass
      `include_receipt_policies: true` to include them." **Add step**:
      `await t.step("get_receptive_policies omits receipt-mode policies by default and includes them when include_receipt_policies is true", ...)`
      **Assert**: accept an invitation (which auto-creates a `mode: "receipt"`
      policy); call `get_receptive_policies` without any extra flags; assert no
      `mode: "receipt"` policies appear in the result; repeat with
      `{ include_receipt_policies: true }`; assert the receipt-mode policy is
      now returned. **Spec ref**: receptive-policy-001 §Behavior, bullet 1.

---

#### receptive-policy-002 — Set receptive policy

File:
[src/requirements/receptive-policy/002-set-receptive-policy.requirement.test.ts](src/requirements/receptive-policy/002-set-receptive-policy.requirement.test.ts)\
Score: 0.67 · Statements: 1 ✓ / 2 ⚠ / 0 ✗

- [ ] **Statement** (⚠ partial — valid modes tested but `receipt` mode as
      invalid input not explicitly rejected): "The `receipt` mode MUST NOT be
      accepted as input to this tool." **Add step**:
      `await t.step("add_receptive_policy returns a structured error when mode is receipt", ...)`
      **Assert**: call `add_receptive_policy` with `{ mode: "receipt" }`; assert
      the tool returns a structured error (not success), indicating `receipt`
      mode is not user-createable. **Spec ref**: receptive-policy-002 §Behavior,
      bullet 1.

- [ ] **Statement** (⚠ partial — domain_filter rule storage tested but
      glob-pattern evaluation semantics are not verified): "When `mode` is
      `domain_filter`, the tool MUST also accept a `domain_filter` object
      containing an ordered list of `allow`/`block` rules with glob patterns."
      **Add step**:
      `await t.step("add_receptive_policy domain_filter accepts and stores glob patterns in allow/block rules", ...)`
      **Assert**: call `add_receptive_policy` with
      `{ mode: "domain_filter", domain_filter: { rules: [{ action: "allow", pattern: "*.example.com" }, { action: "block", pattern: "*" }] } }`;
      assert the stored policy reflects the ordered glob rules; attempt a submit
      message from a matching domain and verify the policy is applied in rule
      order. **Spec ref**: receptive-policy-002 §Behavior, bullet 2.

---

### messages — 91.5% stmt-wt

#### messages-005 — Delete message

File:
[src/requirements/messages/005-delete-message.requirement.test.ts](src/requirements/messages/005-delete-message.requirement.test.ts)\
Score: 0.75 · Statements: 3 ✓ / 1 ⚠ / 1 ✗

- [ ] **Statement** (⚠ partial — visibility removal from list/get verified but
      atomic removal of all index entries not directly observed): "Deletion MUST
      remove the message record and all associated index entries atomically."
      **Add step**:
      `await t.step("deleted message does not appear in list_messages under any filter combination", ...)`
      **Assert**: send a message with a specific `category` and `sender_domain`;
      delete it; call `list_messages` with `{ category: "<used>" }` and
      separately with `{ sender_domain: "<used>" }`; assert the deleted message
      ID does not appear in either result set. **Spec ref**: messages-005
      §Behavior, bullet 2.

- [ ] **Statement** (✗ uncovered): "Deletion MUST NOT revoke or otherwise affect
      any receipt referenced by the message (including `reply_invite`)." **Add
      step**:
      `await t.step("delete_message does not revoke the receipt referenced by the deleted message", ...)`
      **Assert**: obtain a receipt via invitation acceptance; send a message
      that references that receipt's ID; delete the message; call
      `list_issued_receipts` and assert the receipt is still present and not in
      a revoked state. **Spec ref**: messages-005 §Behavior, bullet 4.

---

## Missing test coverage

The following requirement has a test file on disk but contains **no test steps**
and the extractor found no normative statement bullets in the document. It
therefore scores 0.00 and has no statement-level action items above. The test
file must be populated by reading the requirement doc directly.

- [ ] `mcp-auth-007` — populate
      [src/requirements/mcp/auth/007-unauthorized-challenge.requirement.test.ts](src/requirements/mcp/auth/007-unauthorized-challenge.requirement.test.ts).
      The requirement title is "Unauthorized responses include OAuth challenge
      metadata." The key behavior is that a `401 Unauthorized` response MUST
      include a `WWW-Authenticate: Bearer` header containing at minimum
      `resource=` and `as=` parameters pointing to the authorization server. Add
      at least one `t.step` verifying this header is present and well-formed
      when an unauthenticated request is made to `POST /mcp`.
