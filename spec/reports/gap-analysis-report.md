# Gap Analysis Report

**Date**: 2026-05-03 **Scope**: all

## Overall Coverage Scores

| Dimension          | Score                                    |
| ------------------ | ---------------------------------------- |
| Requirement → Test | **86/86 requirements covered (100%)**    |
| RFC → Requirement  | **70/76 RFC tools represented (92.11%)** |

## Summary Tables

### Requirement → Test Coverage

| Category       | Docs | Tests | Missing Tests | Orphan Tests | ID Mismatches |
| -------------- | ---- | ----- | ------------- | ------------ | ------------- |
| All categories | 86   | 86    | 0             | 0            | 0             |

All requirement docs have a mirrored test file and all requirement IDs are
referenced. Two test IDs are referenced by tests but not found as
`requirement_id` frontmatter in any doc (the coverage script treats these as
"unknown"): `deployment-001` and `mcp-auth-012`. Investigation shows both docs
exist — `deployment/001` uses a `requirement_id` frontmatter key and
`mcp/auth/012` has no frontmatter at all. These are doc-format issues, not
missing coverage.

### RFC → Requirement Coverage

| RFC Section | Tool                   | Requirement Doc | Status     |
| ----------- | ---------------------- | --------------- | ---------- |
| 10 (groups) | `create_group`         | —               | ❌ Missing |
| 10 (groups) | `list_groups`          | —               | ❌ Missing |
| 10 (groups) | `get_group`            | —               | ❌ Missing |
| 10.5        | `leave_group`          | —               | ❌ Missing |
| 10B.3       | `list_held_receipts`   | —               | ❌ Missing |
| 10A.2       | `bulk_revoke_receipts` | —               | ❌ Missing |

All 70 other RFC MCP tools have at least one corresponding requirement doc.

## Action Items

### Missing requirement docs (RFC → Requirement gaps)

- [ ] **Missing requirement doc**: RFC tool `create_group` (Section 10, Groups)
      is not represented in `.github/requirements/`. **Action**: ask the user
      whether to add a requirement doc; if yes, create
      `.github/requirements/receipts/<NNN>-create-group.requirement.md` with
      frontmatter `requirement_id` and `title`, then re-run gap-analysis.

- [ ] **Missing requirement doc**: RFC tool `list_groups` (Section 10, Groups)
      is not represented in `.github/requirements/`. **Action**: ask the user
      whether to add a requirement doc; if yes, create
      `.github/requirements/receipts/<NNN>-list-groups.requirement.md` with
      frontmatter `requirement_id` and `title`, then re-run gap-analysis.

- [ ] **Missing requirement doc**: RFC tool `get_group` (Section 10, Groups) is
      not represented in `.github/requirements/`. **Action**: ask the user
      whether to add a requirement doc; if yes, create
      `.github/requirements/receipts/<NNN>-get-group.requirement.md` with
      frontmatter `requirement_id` and `title`, then re-run gap-analysis.

- [ ] **Missing requirement doc**: RFC tool `leave_group` (Section 10.5) is not
      represented in `.github/requirements/`. **Action**: ask the user whether
      to add a requirement doc; if yes, create
      `.github/requirements/receipts/<NNN>-leave-group.requirement.md` with
      frontmatter `requirement_id` and `title`, then re-run gap-analysis.

- [ ] **Missing requirement doc**: RFC tool `list_held_receipts` (Section 10B.3)
      is not represented in `.github/requirements/`. **Action**: ask the user
      whether to add a requirement doc; if yes, create
      `.github/requirements/receipts/<NNN>-list-held-receipts.requirement.md`
      with frontmatter `requirement_id` and `title`, then re-run gap-analysis.

- [ ] **Missing requirement doc**: RFC tool `bulk_revoke_receipts` (Section
      10A.2) is not represented in `.github/requirements/`. **Action**: ask the
      user whether to add a requirement doc; if yes, create
      `.github/requirements/receipts/<NNN>-bulk-revoke-receipts.requirement.md`
      with frontmatter `requirement_id` and `title`, then re-run gap-analysis.

### Doc format issues (test IDs not matched by coverage script)

- [ ] **Doc format issue**: `mcp/auth/012-azure-token-support.requirement.md`
      has no YAML frontmatter with a `requirement_id` field. The test
      `src/requirements/mcp/auth/012-azure-token-support.requirement.test.ts`
      references `req:mcp-auth-012` but the script cannot confirm coverage.
      **Fix**: add frontmatter `requirement_id: req:mcp-auth-012` to the doc.
