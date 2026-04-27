# Gap Analysis Report

**Date**: 2026-04-27  
**Scope**: all  
**Methodology**: RFC → requirement doc → requirement test coverage chain

---

## Overall Coverage Scores

| Layer | Score | Percent |
|-------|-------|---------|
| Requirement → Test (mirrored paths) | 74 / 77 | 96.1% |
| RFC tools → Requirement docs | 48 / 53 | 90.6% |

---

## Layer 1: Requirement → Test Coverage

### Summary

| Metric | Count |
|--------|-------|
| Requirement docs | 77 |
| Requirement test files | 76 |
| Docs with mirrored tests | 74 |
| Missing mirrored tests | 3 |
| Orphan test files (no doc) | 0 |
| Req IDs not referenced by any test | 2 |

### Missing Mirrored Tests

| Requirement Doc | Expected Test Path | Status |
|---|---|---|
| `.github/requirements/invitations/009-cancel-invitation.requirement.md` | `src/requirements/invitations/009-cancel-invitation.requirement.test.ts` | ❌ file missing |
| `.github/requirements/messages/006-sender-claims.requirement.md` | `src/requirements/messages/006-sender-claims.requirement.test.ts` | ❌ file missing |
| `.github/requirements/deployment/001-single-tenant-per-instance.requirement.md` | `src/requirements/deployment/001-single-tenant-per-instance.requirement.test.ts` | ⚠ test exists but doc uses non-standard `requirement_id` frontmatter field instead of `id` |

### Orphan Test Files

None. All 76 test files have a corresponding requirement document.

### Requirement IDs Not Referenced in Tests

| ID | Requirement |
|----|-------------|
| `invitations-009` | `invitations/009-cancel-invitation.requirement.md` |
| `messages-006` | `messages/006-sender-claims.requirement.md` |

(These match the missing mirrored tests above.)

---

## Layer 2: RFC → Requirement Coverage

### Summary

| Metric | Count |
|--------|-------|
| RFC-defined MCP tools (Section 10B) | 53 |
| Tools appearing in requirement docs | 48 |
| Tools with no requirement representation | 5 |
| RFC → requirement coverage | 90.6% |

### RFC Tools by Section

| Section | Tools |
|---------|-------|
| 10B.1 Messaging | `send_message`, `list_messages`, `get_message`, `mark_read`, `delete_message` |
| 10B.2 Group | `create_group`, `list_groups`, `get_group`, `send_group_message`, `leave_group`, `list_group_messages` |
| 10B.3 Receipt | `list_issued_receipts`, `list_held_receipts`, `get_receipt`, `revoke_receipt`, `bulk_revoke_receipts`, `renew_receipt` |
| 10B.4 Invitation | `list_invitations`, `review_invitation`, `accept_invitation`, `reject_invitation`, `cancel_invitation`, `send_invitation`, `create_public_invitation`, `update_public_invitation`, `cancel_public_invitation`, `list_public_invitations`, `fetch_public_invitation`, `accept_public_invitation` |
| 10B.5 Receptive Policy | `get_receptive_policies`, `add_receptive_policy`, `open_receptive_window`, `remove_receptive_policy` |
| 10B.6 Identity | `get_display_name`, `set_display_name`, `set_user_verified_metadata` |
| 10B.7 Domain — Identity & Config | `get_domain_identity`, `update_domain_identity`, `rotate_verification_key`, `get_verification_key`, `list_historical_keys`, `delete_historical_key` |
| 10B.8 Domain — User Verification | `list_verifiable_users`, `get_user_verified_metadata`, `set_admin_verified_metadata`, `remove_admin_verified_metadata` |
| 10B.9 Domain — Contact Info | `get_contact_policy_url`, `set_contact_policy_url` |
| 10B.11 Contacts | `list_contacts`, `get_contact`, `delete_contact`, `set_contact_field`, `invite_contact` |

### RFC Tools With No Requirement Representation

| Tool | RFC Section | Notes |
|------|-------------|-------|
| `create_group` | 10B.2 Group Tools | Entire group feature has no requirements |
| `leave_group` | 10B.2 Group Tools | Entire group feature has no requirements |
| `list_group_messages` | 10B.2 Group Tools | Entire group feature has no requirements |
| `bulk_revoke_receipts` | 10B.3 Receipt Tools | Advanced batch operation |
| `renew_receipt` | 10B.3 Receipt Tools | Atomic revoke+reissue operation |

---

## Significant Gaps

### P0: 2 requirements missing test implementations

Both exist in the authority chain (RFC → requirement doc) but have no test file.

| Gap | Requirement | RFC Tool |
|-----|-------------|----------|
| `invitations-009` | Cancel a direct invitation | `cancel_invitation` |
| `messages-006` | Sender claims in message responses | (cross-cutting, affects `list_messages` + `get_message`) |

### P1: Group feature entirely unrepresented in requirements

RFC Section 10B.2 defines 6 group tools. Zero requirement documents cover any of them. This is the largest single category gap:
- `create_group`
- `list_groups` / `get_group`
- `send_group_message`
- `leave_group`
- `list_group_messages`

Group conversations are defined in RFC Section 10 as a first-class feature. If group support is not planned for this implementation, these tools should be explicitly noted as out-of-scope in a requirement or ADR.

### P2: Advanced receipt operations unrepresented

`bulk_revoke_receipts` and `renew_receipt` are RFC-defined but have no requirement docs. These are optional/advanced operations — consider whether they should be added to the backlog or explicitly marked out-of-scope.

### P3: deployment-001 uses non-standard frontmatter

`.github/requirements/deployment/001-single-tenant-per-instance.requirement.md` uses `requirement_id: req:deployment-001` instead of the standard `id: deployment-001`. The test file references `req:deployment-001` so coverage would fail under automated tooling that reads the `id` field. The frontmatter should be corrected to match the canonical format.

---

## Recommendations

| Priority | Action |
|----------|--------|
| P0 | Create `src/requirements/invitations/009-cancel-invitation.requirement.test.ts` |
| P0 | Create `src/requirements/messages/006-sender-claims.requirement.test.ts` |
| P1 | Decide: add group feature requirements or mark group tools as out-of-scope in a decision doc |
| P2 | Decide: add `bulk_revoke_receipts` and `renew_receipt` requirements or mark out-of-scope |
| P3 | Fix `deployment/001` frontmatter: replace `requirement_id: req:deployment-001` with `id: deployment-001` |
