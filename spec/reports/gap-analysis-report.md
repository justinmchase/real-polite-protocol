# Gap Analysis Report

**Date**: 2026-04-27\
**Scope**: all\
**Methodology**: RFC → requirement doc → requirement test coverage chain

---

## Overall Coverage Scores

| Layer                               | Score    | Percent |
| ----------------------------------- | -------- | ------- |
| Requirement → Test (mirrored paths) | 78 / 79  | 98.73%  |
| RFC tools → Requirement docs        | 65 / 76  | 85.53%  |

---

## Layer 1: Requirement → Test Coverage

### Summary

| Metric                             | Count |
| ---------------------------------- | ----- |
| Requirement docs                   | 79    |
| Requirement test files             | 78    |
| Docs with mirrored tests           | 78    |
| Missing mirrored tests             | 1     |
| Orphan test files (no doc)         | 0     |
| Req IDs not referenced by any test | 1     |
| Unknown test-referenced IDs        | 2     |

### Missing Mirrored Tests

| Requirement Doc                                                         | Expected Test Path                                                       | Status          |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------- |
| `.github/requirements/invitations/009-cancel-invitation.requirement.md` | `src/requirements/invitations/009-cancel-invitation.requirement.test.ts` | ❌ file missing |

### Orphan Test Files

None. All 78 test files have a corresponding requirement document.

### Requirement IDs Not Referenced in Tests

| ID                | Requirement                                        |
| ----------------- | -------------------------------------------------- |
| `invitations-009` | `invitations/009-cancel-invitation.requirement.md` |

### Unknown Test-Referenced IDs

These test files reference a `req:<id>` that has no corresponding doc with
a matching `id:` frontmatter field. The docs exist, but use non-standard
frontmatter — the automated tooling cannot link them.

| Referenced ID   | Test File                                                      | Doc (no `id:` field)                                                                |
| --------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `deployment-001`| `src/requirements/deployment/001-single-tenant-...test.ts`     | `.github/requirements/deployment/001-single-tenant-per-instance.requirement.md`     |
| `mcp-auth-012`  | `src/requirements/mcp/auth/012-azure-token-support.test.ts`    | `.github/requirements/mcp/auth/012-azure-token-support.requirement.md`              |

---

## Layer 2: RFC → Requirement Coverage

### Summary

| Metric                                   | Count  |
| ---------------------------------------- | ------ |
| RFC-defined MCP tools (Section 10B)      | 76     |
| Tools appearing in requirement docs      | 65     |
| Tools with no requirement representation | 11     |
| RFC → requirement coverage               | 85.53% |

### RFC Tools With No Requirement Representation

| Tool                      | Category              | Notes                                            |
| ------------------------- | --------------------- | ------------------------------------------------ |
| `create_public_invitation`| Public Invitations    | Public invitation feature has no requirements    |
| `update_public_invitation`| Public Invitations    | Public invitation feature has no requirements    |
| `list_public_invitations` | Public Invitations    | Public invitation feature has no requirements    |
| `fetch_public_invitation` | Public Invitations    | Public invitation feature has no requirements    |
| `accept_public_invitation`| Public Invitations    | Public invitation feature has no requirements    |
| `create_group`            | Group Tools (10B.2)   | Entire group feature has no requirements         |
| `list_groups`             | Group Tools (10B.2)   | Entire group feature has no requirements         |
| `get_group`               | Group Tools (10B.2)   | Entire group feature has no requirements         |
| `leave_group`             | Group Tools (10B.2)   | Entire group feature has no requirements         |
| `bulk_revoke_receipts`    | Receipt Tools (10B.3) | Advanced batch operation; no requirement doc     |
| `list_held_receipts`      | Receipt Tools (10B.3) | Held receipts (sender perspective); no doc       |

---

## Significant Gaps

### P0: 1 requirement missing a test implementation

Exists in the authority chain (RFC → requirement doc) but has no test file.

| Gap               | Requirement                | RFC Tool             |
| ----------------- | -------------------------- | -------------------- |
| `invitations-009` | Cancel a direct invitation | `cancel_invitation`  |

### P1: Public invitation feature entirely unrepresented in requirements

RFC Section 10B.4 defines public invitation tools (`create_public_invitation`,
`update_public_invitation`, `list_public_invitations`, `fetch_public_invitation`,
`accept_public_invitation`). Zero requirement documents cover any of them.

If public invitations are not planned, these tools should be explicitly marked
out-of-scope in a requirement or ADR.

### P2: Group feature entirely unrepresented in requirements

RFC Section 10B.2 defines group tools (`create_group`, `list_groups`, `get_group`,
`leave_group`). Zero requirement documents cover any of them.

If group conversations are not planned, these tools should be explicitly marked
out-of-scope.

### P3: Advanced receipt operations unrepresented

`bulk_revoke_receipts` and `list_held_receipts` are RFC-defined but have no
requirement docs.

### P4: Non-standard frontmatter on 2 requirement docs

`deployment/001` and `mcp/auth/012` exist on disk and have test files, but use
non-standard frontmatter (`requirement_id:` instead of `id:` / missing `id:`)
so the gap-analysis tooling cannot link them by ID.

---

## Action Items

### Missing test files

- [ ] **Missing test file**: `invitations-009` — Senders can cancel a direct invitation
      **Doc**: [.github/requirements/invitations/009-cancel-invitation.requirement.md](.github/requirements/invitations/009-cancel-invitation.requirement.md)
      **Create**: `src/requirements/invitations/009-cancel-invitation.requirement.test.ts`
      **Top-level test name**: `req:invitations-009 - Senders can cancel a direct invitation`

### Requirement IDs not referenced by any test

- [ ] **ID not covered**: `invitations-009` (same as above — resolves when the test file above is created)

### Frontmatter fixes

- [ ] **Non-standard frontmatter**: `.github/requirements/deployment/001-single-tenant-per-instance.requirement.md`
      uses `requirement_id: req:deployment-001` — change to `id: deployment-001`

- [ ] **Missing frontmatter**: `.github/requirements/mcp/auth/012-azure-token-support.requirement.md`
      has no `id:` field — add `id: mcp-auth-012` to the YAML frontmatter block

### RFC tools without a corresponding requirement doc

- [ ] **Missing requirement doc**: RFC tool `create_public_invitation` (Public Invitations) is not represented in `.github/requirements/`
      **Action**: ask the user whether to add a requirement doc or mark out-of-scope.

- [ ] **Missing requirement doc**: RFC tool `update_public_invitation` (Public Invitations) is not represented in `.github/requirements/`

- [ ] **Missing requirement doc**: RFC tool `list_public_invitations` (Public Invitations) is not represented in `.github/requirements/`

- [ ] **Missing requirement doc**: RFC tool `fetch_public_invitation` (Public Invitations) is not represented in `.github/requirements/`

- [ ] **Missing requirement doc**: RFC tool `accept_public_invitation` (Public Invitations) is not represented in `.github/requirements/`

- [ ] **Missing requirement doc**: RFC tool `create_group` (Section 10B.2) is not represented in `.github/requirements/`

- [ ] **Missing requirement doc**: RFC tool `list_groups` (Section 10B.2) is not represented in `.github/requirements/`

- [ ] **Missing requirement doc**: RFC tool `get_group` (Section 10B.2) is not represented in `.github/requirements/`

- [ ] **Missing requirement doc**: RFC tool `leave_group` (Section 10B.2) is not represented in `.github/requirements/`

- [ ] **Missing requirement doc**: RFC tool `bulk_revoke_receipts` (Section 10B.3) is not represented in `.github/requirements/`

- [ ] **Missing requirement doc**: RFC tool `list_held_receipts` (Section 10B.3) is not represented in `.github/requirements/`

