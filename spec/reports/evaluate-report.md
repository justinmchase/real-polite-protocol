# Semantic Closure Evaluation Report

**Date**: 2026-05-31 (revision 4)\
**Scope**: all\
**Methodology**: Statement-level semantic scoring — 1.0 covered · 0.5 partial ·
0.0 uncovered.\
**How to use this report**: Each unchecked box in § Action Items represents one
missing or weak test step. Work top-to-bottom; mark `[x]` when the corresponding
test step has been added and is passing.

## Overall

| Metric                              | Score                   |
| ----------------------------------- | ----------------------- |
| Requirements fully covered (≥ 0.80) | 72 / 81 (89%)           |
| Requirements partially covered      | 9 / 81 (11%)            |
| Requirements with no covered steps  | 0 / 81 (0%)             |
| Mean per-requirement score          | **0.95**                |
| **Statement-weighted coverage**     | **153.0 / 175 = 87.4%** |

All 81 requirement docs have a paired test file (`gap-analysis` rev 5 confirms
81/81 mirrored). The 9 partially covered requirements account for 34 of 175
normative statements (24 partial + 10 uncovered). No requirement scored 0.0.

## By Category

| Category         | Reqs | Stmts | Stmt-wt% | Covered ≥0.80 | Partial | Uncovered |
| ---------------- | ---: | ----: | -------: | ------------: | ------: | --------: |
| account          |   10 |    21 |    100.0 |            10 |       0 |         0 |
| contacts         |   11 |     0 |      n/a |            11 |       0 |         0 |
| deployment       |    1 |     0 |      n/a |             1 |       0 |         0 |
| domain-admin     |   13 |     4 |    100.0 |            13 |       0 |         0 |
| invitations      |    9 |    29 |     84.5 |             6 |       3 |         0 |
| mcp              |   15 |    38 |     94.7 |            14 |       1 |         0 |
| messages         |    8 |    46 |     85.9 |             7 |       1 |         0 |
| receptive-policy |    6 |    14 |     78.6 |             4 |       2 |         0 |
| submit           |    5 |     9 |     88.9 |             4 |       1 |         0 |
| well-known-paths |    1 |    14 |     64.3 |             0 |       1 |         0 |
| top-level (kv,   |    2 |     0 |      n/a |             2 |       0 |         0 |
| startup)         |      |       |          |               |         |           |
| **Total**        |   81 |   175 |     87.4 |            72 |       9 |         0 |

Categories with `stmts = 0` have no normative bullet-form statements in their
docs (they may use prose-only or table-based requirements that the extractor
does not detect). Their paired tests run green and they are treated as fully
covered until normative bullets are added.

## By Requirement

Only requirements that are not fully covered are listed; everything else scored
1.00 and is omitted for brevity.

| ID                   | Title                                                       | Score | ✓ / ⚠ / ✗ | Notes                                 |
| -------------------- | ----------------------------------------------------------- | :---: | :-------: | ------------------------------------- |
| messages-001         | Listeners can send messages to a known contact              | 0.88  | 6 / 2 / 0 | 2 statements need additional coverage |
| messages-002         | Listeners can list messages in their inbox                  | 0.80  | 2 / 3 / 0 | 3 statements need additional coverage |
| messages-006         | Message responses include all recorded claims               | 0.83  | 5 / 0 / 1 | 1 statement needs test coverage       |
| messages-007         | Message metadata is preserved and returned verbatim         | 0.94  | 7 / 1 / 0 | 1 statement needs additional coverage |
| messages-008         | Listeners can list messages they have sent (outbox)         | 0.75  | 3 / 5 / 0 | 5 statements need additional coverage |
| invitations-004      | Listeners can reject a pending invitation                   | 0.88  | 3 / 1 / 0 | 1 statement needs additional coverage |
| invitations-005      | Senders can send a direct invitation by receptive_policy_id | 0.50  | 0 / 1 / 0 | 1 statement needs additional coverage |
| invitations-006      | Senders can attach verified and custom claims               | 0.93  | 6 / 1 / 0 | 1 statement needs additional coverage |
| invitations-007      | Senders can list invitations they have sent (outbox)        | 0.50  | 2 / 3 / 1 | 4 statements need additional coverage |
| invitations-008      | Servers handle inbound invitation_reply envelopes           | 0.75  | 1 / 1 / 0 | 1 statement needs additional coverage |
| submit-004           | Envelope requests are validated against the category schema | 0.88  | 3 / 1 / 0 | 1 statement needs additional coverage |
| submit-005           | Envelope delivery bypasses outbound HTTP for same-domain    | 0.75  | 1 / 1 / 0 | 1 statement needs additional coverage |
| mcp-001              | Tools use structured output with outputSchema               | 0.92  | 5 / 1 / 0 | 1 statement needs additional coverage |
| mcp-auth-006         | OAuth discovery metadata is published                       | 0.89  | 8 / 1 / 0 | 1 statement needs additional coverage |
| mcp-auth-012         | Azure AD/Entra ID Token v2.0 compatibility                  | 0.71  | 5 / 2 / 0 | 3 statements need additional coverage |
| receptive-policy-003 | Listeners can open a time-bounded receptive window          | 0.67  | 2 / 0 / 1 | 1 statement needs test coverage       |
| receptive-policy-007 | Receptive windows expose a shareable shortcode              | 0.78  | 7 / 0 / 2 | 2 statements need test coverage       |
| well-known-001       | Domain identity well-known endpoint                         | 0.64  | 9 / 0 / 5 | 5 statements need test coverage       |

## Action Items

Action items are grouped by category, then by requirement id. Categories appear
in ascending statement-weighted-coverage order so the weakest areas come first.

### well-known-paths (64.3%)

#### well-known-001 — Domain identity well-known endpoint

File:
[src/requirements/well-known-paths.requirement.test.ts](src/requirements/well-known-paths.requirement.test.ts)
Score: 0.64 · Statements: 9 ✓ / 0 ⚠ / 5 ✗

- [ ] **Statement** (✗ uncovered): "The response MAY include `domain_type` — one
      of the registered domain type values (`personal`, `business`, `academic`,
      `government`, `nonprofit`, `healthcare`, `media`)." **Add step**:
      `await t.step("optional domain_type, when present, is one of the registered values", ...)`
      **Assert**: fetch endpoint; if `body.domain_type` is present, it must be
      one of the seven enumerated strings. **Spec ref**: §4.3 bullet 8.
- [ ] **Statement** (✗ uncovered): "The response MAY include `parent_domain` — a
      parent organization domain." **Add step**:
      `await t.step("optional parent_domain, when present, is a string", ...)`
      **Assert**: if `body.parent_domain` is present,
      `assertEquals(typeof body.parent_domain, "string")`. **Spec ref**: §4.3
      bullet 9.
- [ ] **Statement** (✗ uncovered): "The response MAY include
      `categories_offered` — an array of message category strings this domain
      typically sends." **Add step**:
      `await t.step("optional categories_offered, when present, is a string array", ...)`
      **Assert**: if `body.categories_offered` is present,
      `assertEquals(Array.isArray(body.categories_offered), true)` and every
      entry is a string. **Spec ref**: §4.3 bullet 10.
- [ ] **Statement** (✗ uncovered): "The response MAY include `rpp_since` — an
      ISO 8601 timestamp of when the domain first began operating an RPP
      server." **Add step**:
      `await t.step("optional rpp_since, when present, parses as a Date", ...)`
      **Assert**: if `body.rpp_since` is present,
      `assertEquals(Number.isFinite(new Date(body.rpp_since).getTime()), true)`.
      **Spec ref**: §4.3 bullet 11.
- [ ] **Statement** (✗ uncovered): "The response MAY include
      `contact_policy_url` — a URL for out-of-band administrative contact."
      **Add step**:
      `await t.step("optional contact_policy_url, when present, is a string URL", ...)`
      **Assert**: if `body.contact_policy_url` is present,
      `new URL(body.contact_policy_url)` does not throw. **Spec ref**: §4.3
      bullet 12.

> The remaining statement "Peers that receive a 404 from this endpoint MUST fall
> back to the conventional endpoint paths" describes peer-side behavior and is
> not exercisable from this server-side test file; covered indirectly by
> integration tests in `submit/`. No action item.

### receptive-policy (78.6%)

#### receptive-policy-003 — Listeners can open a time-bounded receptive window

File:
[src/requirements/receptive-policy/003-open-receptive-window.requirement.test.ts](src/requirements/receptive-policy/003-open-receptive-window.requirement.test.ts)
Score: 0.67 · Statements: 2 ✓ / 0 ⚠ / 1 ✗

- [ ] **Statement** (✗ uncovered): "After `receptive_until` has passed, the
      policy is no longer active and invitation delivery using its `policy_id`
      MUST be rejected with `E_RECEPTIVE_POLICY_EXPIRED` (§13)." **Add step**:
      `await t.step("invitation delivery against expired window rejected with E_RECEPTIVE_POLICY_EXPIRED", ...)`
      **Assert**: open a window with `duration_seconds: 1`; wait > 1s; submit an
      `invitation` envelope addressed to that `receptive_policy_id`; expect HTTP
      4xx with body `code === "E_RECEPTIVE_POLICY_EXPIRED"`. **Spec ref**: §9.2
      bullet 3 / §13.

#### receptive-policy-007 — Receptive windows expose a shareable shortcode

File:
[src/requirements/receptive-policy/007-receptive-window-shortcode.requirement.test.ts](src/requirements/receptive-policy/007-receptive-window-shortcode.requirement.test.ts)
Score: 0.78 · Statements: 7 ✓ / 0 ⚠ / 2 ✗

- [ ] **Statement** (✗ uncovered): "The MCP tool description MUST explicitly
      instruct the AI agent to present `shortcode` and `domain` to the local
      user in a clearly copyable form (e.g. a fenced code block or quoted
      string) immediately after the tool call completes." **Add step**:
      `await t.step("open_receptive_window tool description instructs agent to present shortcode+domain", ...)`
      **Assert**: from a `tools/list` response, locate `open_receptive_window`;
      `assertStringIncludes(tool.description.toLowerCase(), "shortcode")` and
      `assertStringIncludes(tool.description.toLowerCase(), "domain")` and the
      description references presenting them to the user (e.g. "show",
      "present", "display"). **Spec ref**: §10C.2.
- [ ] **Statement** (✗ uncovered): "The shortcode index entry MUST be written
      atomically with the policy record." **Add step**:
      `await t.step("shortcode index and policy record are written atomically (no orphan index after failed write)", ...)`
      **Assert**: induce a write failure between the policy and the index (e.g.
      monkey-patch the second `kv.set` to throw); after recovery, neither the
      policy nor the index exists — calling `send_invitation` with that
      shortcode returns `E_RECEPTIVE_POLICY_NOT_FOUND` and the policy is absent
      from `get_receptive_policies`. **Spec ref**: §9.7. _If atomicity is
      enforced via a single `kv.atomic()` transaction, this can alternatively be
      a code-review checkbox; mark it covered after grepping for `kv.atomic()`
      in the open_receptive_window code path._

### invitations (84.5%)

#### invitations-004 — Listeners can reject a pending invitation

File:
[src/requirements/invitations/004-reject-invitation.requirement.test.ts](src/requirements/invitations/004-reject-invitation.requirement.test.ts)
Score: 0.88 · Statements: 3 ✓ / 1 ⚠ / 0 ✗

- [ ] **Statement** (⚠ partial — only indirect evidence): "Rejection MUST NOT
      dispatch any outbound envelope to the remote sender. Silence is the
      protocol-level rejection signal (§10.5)." **Add step**:
      `await t.step("reject_invitation makes no outbound HTTP request", ...)`
      **Assert**: wrap in `withRemoteServer`; capture HTTP calls; after
      `reject_invitation`, `assertEquals(getCaptures().length, 0)`. **Spec
      ref**: §10.5.

#### invitations-005 — Senders can send a direct invitation by receptive_policy_id

File:
[src/requirements/invitations/005-send-invitation.requirement.test.ts](src/requirements/invitations/005-send-invitation.requirement.test.ts)
Score: 0.50 · Statements: 0 ✓ / 1 ⚠ / 0 ✗

- [ ] **Statement** (⚠ partial — `verification` and `expires_at` not exercised):
      "The tool MAY accept `message`, `include_user_claims`,
      `include_admin_claims`, `custom_claims`, `verification`, and `expires_at`
      per §10.1 / §10.6 / §10.7." **Add step**:
      `await t.step("send_invitation accepts optional verification and expires_at parameters", ...)`
      **Assert**: pass `expires_at: new Date(Date.now() + 3_600_000)` and
      `verification: { … }`; capture the outbound envelope; assert envelope's
      `expires_at` matches and `claims.verification` is forwarded. **Spec ref**:
      §10.1 / §10.7.

#### invitations-006 — Senders can attach verified and custom claims

File:
[src/requirements/invitations/006-send-invitation-claims.requirement.test.ts](src/requirements/invitations/006-send-invitation-claims.requirement.test.ts)
Score: 0.93 · Statements: 6 ✓ / 1 ⚠ / 0 ✗

- [ ] **Statement** (⚠ partial — separation shown but unverified-nature not
      asserted): "`custom` claims are caller-supplied. They MUST be clearly
      distinguished as unverified. Remotes MUST NOT treat them as
      authoritative." **Add step**:
      `await t.step("custom claims appear under claims.custom (separate from immutable/user/admin)", ...)`
      **Assert**: capture the outbound invitation envelope; assert the same key
      provided in `custom_claims` appears only under `env.claims.custom` and not
      under `env.claims.user`, `env.claims.admin`, or `env.claims.immutable`.
      **Spec ref**: §10.6.

#### invitations-007 — Senders can list invitations they have sent (outbox)

File:
[src/requirements/invitations/007-list-sent-invitations.requirement.test.ts](src/requirements/invitations/007-list-sent-invitations.requirement.test.ts)
Score: 0.50 · Statements: 2 ✓ / 3 ⚠ / 1 ✗

- [ ] **Statement** (⚠ partial — only `status` and `receiver_domain` filters
      tested): "The tool MUST support filtering by: `status`, `receiver_domain`,
      `sent_after`/`sent_before` (ISO 8601 timestamps)." **Add step**:
      `await t.step("list_sent_invitations filters by sent_after and sent_before", ...)`
      **Assert**: seed three outbound invitations with `sent_at` values spread
      across a known range; call with `sent_after` matching the middle entry;
      `assertEquals(result.invitations.every(i => new Date(i.sent_at) >= sentAfter), true)`.
      **Spec ref**: §12.7.
- [ ] **Statement** (⚠ partial — default ordering not asserted): "Results MUST
      be ordered by `sent_at` descending by default." **Add step**:
      `await t.step("list_sent_invitations orders results by sent_at descending", ...)`
      **Assert**: seed ≥ 3 outbound invitations with distinct `sent_at`; call
      with no filters; assert returned `sent_at` array is monotonically
      non-increasing. **Spec ref**: §12.7.
- [ ] **Statement** (⚠ partial — pagination mechanics not asserted): "Results
      MUST be paginated via resume-token pagination (§12.8)." **Add step**:
      `await t.step("list_sent_invitations paginates via resume_token", ...)`
      **Assert**: seed ≥ 3 outbound invitations; call with `page_size: 1`;
      `assertExists(result.next_resume_token)`; call again with that token;
      assert distinct second page. **Spec ref**: §12.8.
- [ ] **Statement** (✗ uncovered): "Absent any `invitation_reply` and any
      explicit cancellation, the local domain MAY mark the record `rejected`
      only after a long inactivity window — silence is the protocol-level
      rejection signal (§10.5). The exact inactivity threshold is
      implementation-defined." **Add step**: _OR_ code-review checkbox. If there
      is an inactivity sweep implemented, write
      `await t.step("outbound invitation transitions to rejected after inactivity threshold", ...)`
      that seeds an aged outbound record (forced `sent_at` past the threshold),
      triggers/awaits the sweep, and asserts status becomes `rejected`. If no
      sweep exists yet, document it as deliberately-deferred and remove the
      MAY-bullet from the requirement doc instead. **Spec ref**: §10.5.

#### invitations-008 — Servers handle inbound invitation_reply envelopes

File:
[src/requirements/invitations/008-invitation-reply.requirement.test.ts](src/requirements/invitations/008-invitation-reply.requirement.test.ts)
Score: 0.75 · Statements: 1 ✓ / 1 ⚠ / 0 ✗

- [ ] **Statement** (⚠ partial — covered in submit-003 but not asserted here):
      "A duplicate envelope (same `envelope_id`) MUST be rejected with
      `E_DUPLICATE_ENVELOPE` per `req:submit-003`." **Add step**:
      `await t.step("duplicate invitation_reply envelope rejected with E_DUPLICATE_ENVELOPE", ...)`
      **Assert**: submit a valid `invitation_reply` envelope (202); re-submit
      the byte-identical envelope; assert HTTP 4xx with body
      `code === "E_DUPLICATE_ENVELOPE"`. **Spec ref**: §5, req:submit-003.

### messages (85.9%)

#### messages-001 — Listeners can send messages to a known contact

File:
[src/requirements/messages/001-send-message.requirement.test.ts](src/requirements/messages/001-send-message.requirement.test.ts)
Score: 0.88 · Statements: 6 ✓ / 2 ⚠ / 0 ✗

- [ ] **Statement** (⚠ partial — metadata acceptance lives in messages-007 but
      not in send_message's own test): "The tool MAY accept: `subject` —
      informational subject line; `metadata` — a free-form object passed through
      to the remote." **Add step**:
      `await t.step("send_message accepts optional metadata and forwards it on the outbound envelope", ...)`
      **Assert**: with `metadata: { trace_id: "abc", priority: 2 }`, capture
      outbound envelope, assert `env.metadata` deeply equals the input. **Spec
      ref**: §7.1 bullet 2.
- [ ] **Statement** (⚠ partial — uniqueness tested, UUIDv7 format not): "The
      server MUST generate a UUIDv7 `envelope_id` and ensure
      `(sender_domain, envelope_id)` is unique per the local sender domain."
      **Add step**:
      `await t.step("send_message generates envelope_id in UUIDv7 form", ...)`
      **Assert**: capture outbound envelope; assert `env.envelope_id` matches
      `/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/`;
      decode the timestamp prefix and assert it is within ±5s of `Date.now()`.
      **Spec ref**: §6 envelope identity.

#### messages-002 — Listeners can list messages in their inbox

File:
[src/requirements/messages/002-list-messages.requirement.test.ts](src/requirements/messages/002-list-messages.requirement.test.ts)
Score: 0.80 · Statements: 2 ✓ / 3 ⚠ / 0 ✗

- [ ] **Statement** (⚠ partial — date-range filters missing): "The tool MUST
      support filtering by: `category`, `contact_id`, `sender_domain`,
      `received_after`/`received_before`, `read`." **Add step**:
      `await t.step("list_messages filters by received_after and received_before", ...)`
      **Assert**: seed three messages with distinct `received_at`; call with
      `received_after` set to the middle timestamp; assert returned messages all
      satisfy `new Date(m.received_at) >= received_after`. **Spec ref**: §12.7.
- [ ] **Statement** (⚠ partial — implicit, not asserted): "Offset-based
      pagination MUST NOT be used." **Add step**:
      `await t.step("list_messages does not expose offset parameter in inputSchema", ...)`
      **Assert**: from `tools/list`, locate `list_messages`; assert
      `tool.inputSchema.properties` has no `offset` key (and no `skip` key).
      **Spec ref**: §12.8.

#### messages-006 — Message responses include all recorded claims

File:
[src/requirements/messages/006-sender-claims.requirement.test.ts](src/requirements/messages/006-sender-claims.requirement.test.ts)
Score: 0.83 · Statements: 5 ✓ / 0 ⚠ / 1 ✗

- [ ] **Statement** (✗ uncovered): "The shape of each claim value MUST match the
      contact field value type: string, number, boolean, null, or a flat array
      of those." **Add step**:
      `await t.step("sender_claims value shapes conform to allowed scalar / flat-array types", ...)`
      **Assert**: seed the contact with at least one value of each allowed type
      (string, number, boolean, null, and a flat array of strings); fetch via
      `get_message`; for every value in `sender_claims`, assert it is one of the
      scalar types or a flat array of those (no nested objects, no nested
      arrays). **Spec ref**: §11 contact field value types.

#### messages-007 — Message metadata is preserved and returned verbatim

File:
[src/requirements/messages/007-metadata.requirement.test.ts](src/requirements/messages/007-metadata.requirement.test.ts)
Score: 0.94 · Statements: 7 ✓ / 1 ⚠ / 0 ✗

- [ ] **Statement** (⚠ partial — implicit, not asserted): "The server MUST NOT
      interpret or act on `metadata` contents." **Add step**:
      `await t.step("server treats metadata as opaque (mixed-shape values accepted and returned verbatim)", ...)`
      **Assert**: send a message with
      `metadata: { s: "x", n: 1, b: true, n2: null, arr: [1,2,3] }`; fetch via
      `get_message`; assert `stored.metadata` deep-equals the input, no
      normalization or coercion. **Spec ref**: §7.1 metadata.

#### messages-008 — Listeners can list messages they have sent (outbox)

File:
[src/requirements/messages/008-list-sent-messages.requirement.test.ts](src/requirements/messages/008-list-sent-messages.requirement.test.ts)
Score: 0.75 · Statements: 3 ✓ / 5 ⚠ / 0 ✗

- [ ] **Statement** (⚠ partial — date-range filters missing): "The tool MUST
      support filtering by: `category`, `contact_id`, `remote_domain`,
      `sent_after`/`sent_before`, `status`." **Add step**:
      `await t.step("list_sent_messages filters by sent_after and sent_before", ...)`
      **Assert**: seed three outbox records with distinct `sent_at`; call with
      `sent_after` set to the middle timestamp; assert returned messages satisfy
      `new Date(m.sent_at) >= sent_after`. **Spec ref**: §12.7.
- [ ] **Statement** (⚠ partial — implicit, not asserted): "Offset-based
      pagination MUST NOT be used." **Add step**:
      `await t.step("list_sent_messages does not expose offset parameter in inputSchema", ...)`
      **Assert**: from `tools/list`, locate `list_sent_messages`; assert
      `tool.inputSchema.properties` has no `offset` or `skip` key. **Spec ref**:
      §12.8.
- [ ] **Statement** (⚠ partial — record exists but creation trigger not
      verified): "The server MUST write an outbox record immediately after
      receiving a 2xx response from the remote (status `\"delivered\"`)." **Add
      step**:
      `await t.step("send_message to a successful remote produces outbox record with status=delivered", ...)`
      **Assert**: with `withRemoteServer` returning 202, call `send_message`;
      immediately call `list_sent_messages`; assert returned record exists with
      `status === "delivered"` and matching `envelope_id`. **Spec ref**: §7.1.4.
- [ ] **Statement** (⚠ partial — record exists but creation trigger not
      verified): "The server MUST also write an outbox record with status
      `\"failed\"` when the remote returns a non-2xx, so the sender has a
      delivery audit trail." **Add step**:
      `await t.step("send_message to a failing remote produces outbox record with status=failed", ...)`
      **Assert**: with `withFailingRemoteServer` returning 500, call
      `send_message`; assert tool returns error; immediately call
      `list_sent_messages`; assert a record exists with `status === "failed"`
      and the same `envelope_id`. **Spec ref**: §7.1.4.

### submit (88.9%)

#### submit-004 — Envelope requests are validated against the category schema

File:
[src/requirements/submit/004-submit-envelope-validation.requirement.test.ts](src/requirements/submit/004-submit-envelope-validation.requirement.test.ts)
Score: 0.88 · Statements: 3 ✓ / 1 ⚠ / 0 ✗

- [ ] **Statement** (⚠ partial — enforcement covered in messages-001 not in
      submit-004 envelope-level test): "The named contact's
      `remote_terms.categories` MUST include this message's `category` and
      `remote_terms.max_content_rating` MUST be at least as permissive as
      `content_rating`. On violation reject with `E_CATEGORY_NOT_PERMITTED` or
      `E_CONTENT_RATING_EXCEEDED`." **Add step**:
      `await t.step("message envelope with disallowed category rejected at /envelopes with E_CATEGORY_NOT_PERMITTED", ...)`
      **Assert**: seed a contact whose `local_terms.categories` does NOT include
      `correspondence`; POST a signed `message` envelope with
      `category: "correspondence"`; expect HTTP 4xx with body
      `code === "E_CATEGORY_NOT_PERMITTED"`. Repeat with a rating exceeding
      `max_content_rating` and assert `code === "E_CONTENT_RATING_EXCEEDED"`.
      **Spec ref**: §11.5.

#### submit-005 — Envelope delivery bypasses outbound HTTP for same-domain

File:
[src/requirements/submit/005-same-domain-bypass.requirement.test.ts](src/requirements/submit/005-same-domain-bypass.requirement.test.ts)
Score: 0.75 · Statements: 1 ✓ / 1 ⚠ / 0 ✗

- [ ] **Statement** (⚠ partial — local delivery tested but HMAC skipping not
      directly asserted): "When the domains match, the server calls the local
      handler directly without making any HTTP request. HMAC signing and
      verification MAY be skipped on the local path…" **Add step**:
      `await t.step("same-domain send_message bypass does not perform outbound HTTP", ...)`
      **Assert**: register a sentinel `fetch` stub that throws if called for the
      local envelopes endpoint; run a same-domain `send_message`; assert the
      stub is not invoked, and the inbox contains the message. **Spec ref**: §5
      same-domain bypass.

### mcp (94.7%)

#### mcp-001 — Tools use structured output with outputSchema

File:
[src/requirements/mcp/001-tool-output-format.requirement.test.ts](src/requirements/mcp/001-tool-output-format.requirement.test.ts)
Score: 0.92 · Statements: 5 ✓ / 1 ⚠ / 0 ✗

- [ ] **Statement** (⚠ partial — behavior tested, helper-use not verified):
      "Tool handlers SHOULD use the shared `toolResult()` helper from
      `src/tools/tool-result.ts` to produce both `structuredContent` and the
      text fallback from a single data object." **Add step**:
      `await t.step("tool text fallback content is exactly JSON.stringify(structuredContent) (toolResult shape)", ...)`
      **Assert**: for several tool calls (`get_permissions`, `get_display_name`,
      `list_contacts`), assert
      `content[0].text === JSON.stringify(structuredContent)` verbatim (no
      whitespace or key-order drift). **Spec ref**: mcp-001 bullet 6.

#### mcp-auth-006 — OAuth discovery metadata is published

File:
[src/requirements/mcp/auth/006-discovery-metadata.requirement.test.ts](src/requirements/mcp/auth/006-discovery-metadata.requirement.test.ts)
Score: 0.89 · Statements: 8 ✓ / 1 ⚠ / 0 ✗

- [ ] **Statement** (⚠ partial — empty-body scenario not asserted):
      "`POST
      /register` MUST succeed even when the request body is empty
      or omitted." **Add step**:
      `await t.step("POST /register succeeds with empty body and returns default client_id", ...)`
      **Assert**: `POST /register` with `body: undefined` (no `Content-Type`);
      assert HTTP 201; assert response contains `client_id` and
      `token_endpoint_auth_method: "none"`. Repeat with `body: ""` and the same
      assertions. **Spec ref**: RFC 7591 §3.1.

#### mcp-auth-012 — Azure AD/Entra ID Token v2.0 compatibility

File:
[src/requirements/mcp/auth/012-azure-token-support.requirement.test.ts](src/requirements/mcp/auth/012-azure-token-support.requirement.test.ts)
Score: 0.71 · Statements: 5 ✓ / 2 ⚠ / 0 ✗

- [ ] **Statement** (✗ uncovered): "The server MUST also accept the v1.0 issuer
      `https://sts.windows.net/{tenant-id}/` for the same tenant." **Add step**:
      `await t.step("accepts v1.0 issuer https://sts.windows.net/{tenant}/", ...)`
      **Assert**: mint a token whose `iss` is
      `https://sts.windows.net/<tenantId>/` and other claims valid; submit to
      `/mcp`; assert HTTP 200 on `tools/list`. **Spec ref**: requirement bullet
      on v1.0 issuer.
- [ ] **Statement** (✗ uncovered): "The server MUST compare issuers by
      extracting and matching tenant IDs, regardless of host or path differences
      between v1.0 and v2.0 formats." **Add step**:
      `await t.step("rejects a v1.0-format issuer whose tenant id does not match the configured tenant", ...)`
      **Assert**: mint a token with
      `iss: "https://sts.windows.net/<wrong-tenant>/"`; assert HTTP 401 with
      structured error. Pair with the v1.0-accept test above to demonstrate
      tenant extraction is happening. **Spec ref**: requirement bullet on issuer
      comparison.
- [ ] **Statement** (⚠ partial — short-form scopes work, normalization not
      asserted): "Scopes appear in short form (e.g., `rpp.tools.read`) without
      the `api://` prefix. The server MUST normalize scope names before
      comparison." **Add step**:
      `await t.step("server accepts api://<client-id>/rpp.tools.read and rpp.tools.read interchangeably", ...)`
      **Assert**: mint two tokens with identical claims except one has
      `scp: "rpp.tools.read"` and the other has
      `scp: "api://<client-id>/rpp.tools.read"`; both produce a 200 on a
      `read`-gated tool. **Spec ref**: requirement bullet on scope
      normalization.

## Missing test files

_None._ All 81 requirement docs have a paired test file on disk.

## Methodology Notes

- Extractor: `.github/skills/evaluate/scripts/extract.ts` reads normative
  bullets (lines starting with `-` containing MUST / MUST NOT / SHOULD / SHOULD
  NOT / MAY / REQUIRED) from each requirement doc and pairs them with the
  first-argument string of every `t.step(...)` in the paired test file.
- The extractor reported 180 normative statements; this report scored 175. Five
  statements in `submit/` were collapsed into adjacent multi-clause bullets by
  the extractor and scored together; the rounding effect on the
  statement-weighted percentage is < 0.5pp.
- Categories `contacts`, `deployment`, `kv-path`, and `startup` have no
  bullet-form normative statements. Their requirement docs use prose, tables, or
  imperative descriptions, all of which their paired tests exercise. These
  categories are treated as fully covered for the purposes of this report; if
  bullet-form normatives are added later they will be re-scored.
- Structural coverage (`gap-analysis-report.md` rev 5) is the separate axis:
  81/81 mirrored tests, 38/38 RFC tools represented, 0 orphan tests.
