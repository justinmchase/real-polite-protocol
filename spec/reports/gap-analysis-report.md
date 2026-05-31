# Gap Analysis Report

**Date**: 2026-05-31\
**Scope**: all\
**Revision**: 5 (post gap-fix sweep)

## Overall Coverage

- **Requirement → test**: 81/81 requirements covered by tests (100%)
- **RFC → requirement**: 38/38 RFC tools represented by requirements (100%)
- **Significant structural gaps**: none detected

All previously documented action items from revision 4 have been resolved (see §
Changelog below). The repository currently has full structural coverage: every
requirement doc has a mirrored requirement test, every requirement id is
referenced by at least one test, no orphan tests exist, and every RFC tool in
spec §12 maps to at least one requirement doc.

## Summary Tables

### Requirement → Test (mirrored path coverage)

| Area             | Docs | Tests | Mirrored | Orphan tests | ID coverage |
| ---------------- | ---: | ----: | -------: | -----------: | ----------: |
| account          |   10 |    10 |    10/10 |            0 |       10/10 |
| contacts         |   11 |    11 |    11/11 |            0 |       11/11 |
| deployment       |    1 |     1 |      1/1 |            0 |         1/1 |
| domain-admin     |   14 |    14 |    14/14 |            0 |       14/14 |
| invitations      |    9 |     9 |      9/9 |            0 |         9/9 |
| mcp              |   19 |    19 |    19/19 |            0 |       19/19 |
| messages         |    8 |     8 |      8/8 |            0 |         8/8 |
| receipts         |    0 |     0 |      0/0 |            0 |         0/0 |
| receptive-policy |    6 |     6 |      6/6 |            0 |         6/6 |
| submit           |    5 |     5 |      5/5 |            0 |         5/5 |
| (top-level: kv,  |    3 |     3 |      3/3 |            0 |         3/3 |
| startup, etc.)   |      |       |          |              |             |
| **Total**        |   81 |    81 |    81/81 |            0 |       81/81 |

### RFC → Requirement (spec §12 tool catalog)

| RFC category                  | Tools | Covered | Uncovered |
| ----------------------------- | ----: | ------: | --------: |
| 12.1 Messaging                |     4 |       4 |         0 |
| 12.2 Invitation               |     6 |       6 |         0 |
| 12.3 Receptive Policy         |     4 |       4 |         0 |
| 12.4 Contact                  |     7 |       7 |         0 |
| 12.5 Identity                 |     3 |       3 |         0 |
| 12.6 Domain Mgmt - Identity   |     4 |       4 |         0 |
| 12.7 Domain Mgmt - User Verif |     5 |       5 |         0 |
| 12.8 Domain Mgmt - Contact    |     5 |       5 |         0 |
| **Total**                     |    38 |      38 |         0 |

## Action Items

No outstanding structural gaps. All items from revision 4 have been resolved.

## Changelog (revision 4 → revision 5)

The following nine action items from the previous report were addressed.
Full-suite status after the sweep: **83 passed / 352 steps / 0 failed**;
`deno fmt`, `deno lint`, and `deno task check` all clean.

- [x] **submit-002** — `InvitationReplyEnvelopeHandler.resolveAuth` now throws
      `SubmitContactNotFoundError` (403 `E_CONTACT_NOT_FOUND`) when the
      `x-rpp-contact-id` header does not resolve, regardless of envelope
      category. Test step in
      [src/requirements/submit/002-submit-hmac-auth.requirement.test.ts](src/requirements/submit/002-submit-hmac-auth.requirement.test.ts)
      flipped from `GAP` to required behavior.
- [x] **submit-004** — `InvitationClaimsSchema.immutable` now refines that
      `domain_id` be a non-empty string. Empty `claims.immutable.domain_id` on
      invitation envelopes is now rejected with `E_INVALID_INVITATION_ENVELOPE`.
      Test in
      [src/requirements/submit/004-submit-envelope-validation.requirement.test.ts](src/requirements/submit/004-submit-envelope-validation.requirement.test.ts)
      updated.
- [x] **contacts-005** — Added `MessageRepository.deleteByContact` and
      `MessageManager.deleteByContact`; `ContactManager.delete` cascade-deletes
      every stored message for the contact. Test in
      [src/requirements/contacts/005-delete-contact.requirement.test.ts](src/requirements/contacts/005-delete-contact.requirement.test.ts)
      flipped from `GAP` to required behavior.
- [x] **contacts-006** — Registered new `invite_contact` MCP tool in
      [src/tools/invitations/invitations.tool.ts](src/tools/invitations/invitations.tool.ts).
      Validates blocked contacts (`E_CONTACT_BLOCKED`), uses
      `contact.remote_domain` as receiver, generates a fresh `reply_credential`.
      Test in
      [src/requirements/contacts/006-invite-contact.requirement.test.ts](src/requirements/contacts/006-invite-contact.requirement.test.ts)
      rewritten as a real green-path test (was previously pinning unimplemented
      behavior). `invite_contact` added to the mcp-002 catalog spot-check.
- [x] **contacts-011** — `MessageEnvelopeHandler.handle` now enforces
      `contact.local_terms.categories` and `max_content_rating` on every inbound
      message envelope. New errors `CategoryNotPermittedError`
      (`E_CATEGORY_NOT_PERMITTED`) and `ContentRatingNotPermittedError`
      (`E_CONTENT_RATING_NOT_PERMITTED`) added in
      [src/controllers/submit/submit.error.ts](src/controllers/submit/submit.error.ts).
      Both `GAP` steps in
      [src/requirements/contacts/011-soft-term-enforcement.requirement.test.ts](src/requirements/contacts/011-soft-term-enforcement.requirement.test.ts)
      flipped to required behavior.
- [x] **receptive-policy-007** — `dispatchInvitationEnvelope` now forwards
      `x-rpp-shortcode` when invoked with a shortcode option, and the receiver
      side `assertSingleIdentityHeader` in
      [src/controllers/submit/message.controller.ts](src/controllers/submit/message.controller.ts)
      now accepts that header for invitation envelopes. Test step in
      [src/requirements/receptive-policy/007-receptive-window-shortcode.requirement.test.ts](src/requirements/receptive-policy/007-receptive-window-shortcode.requirement.test.ts)
      flipped from `GAP` to required behavior.
- [x] **mcp-002 receipts note** — Removed the stale "receipt tools missing" note
      from
      [src/requirements/mcp/002-tool-list.requirement.test.ts](src/requirements/mcp/002-tool-list.requirement.test.ts).
      Verified that neither the RFC nor any requirement doc requires
      `list_issued_receipts` or `revoke_receipt`; the prior revision 4 note was
      a false positive.
- [x] **invitations-003 doc drift** — Updated
      [.github/requirements/invitations/003-accept-invitation.requirement.md](.github/requirements/invitations/003-accept-invitation.requirement.md)
      to match the implementation: `local_terms` (not `communication_terms`), no
      claim selectors, no `verification` flag.
- [x] **contacts-002 source-label drift** — Updated
      [.github/requirements/contacts/002-contact-field-accumulation.requirement.md](.github/requirements/contacts/002-contact-field-accumulation.requirement.md)
      so the `source` enum labels (`sender_verified` / `domain_admin` /
      `sender_custom`) match the values produced by code.
- [x] **envelope `kind` → `category` sweep** — Replaced every reference to the
      envelope discriminator `kind` with `category` across the five affected
      requirement docs (`submit/001`, `submit/002`, `submit/003`, `submit/004`,
      `invitations/005`, `invitations/006`, `invitations/008`).

## Notes

- The gap analysis script tracks only structural coverage. Semantic closure
  (whether each test actually exercises the meaning of its requirement) is
  tracked separately in
  [spec/reports/evaluate-report.md](spec/reports/evaluate-report.md).
- This report replaces revision 4 in full.
