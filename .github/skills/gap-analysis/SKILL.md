---
name: gap-analysis
description: "Perform RFC -> requirements -> tests gap analysis. Use when: evaluating specification coverage, finding missing requirement tests, identifying RFC behaviors not represented in requirements, and producing coverage scores and significant gap lists."
---

# Gap Analysis

Use these scripts to evaluate coverage across the authority chain:

1. RFC/spec (`spec/rpp-spec.md`)
2. Requirement docs (`.github/requirements/**`)
3. Requirement tests (`src/requirements/**`)

## Scripts

- `scripts/requirement_test_coverage.ts`
  - Computes mirrored-path coverage (`.github/requirements/*.requirement.md` ->
    `src/requirements/*.requirement.test.ts`)
  - Verifies requirement `id` values are referenced by tests (`req:<id>`)
  - Reports missing tests, orphan tests, and ID mismatches

- `scripts/rfc_requirement_coverage.ts`
  - Extracts MCP tool names from RFC Section 10B
  - Checks whether each RFC tool is represented in requirement docs
  - Reports uncovered RFC tools (RFC -> requirement gaps)

- `scripts/full_gap_analysis.ts`
  - Runs both analyses and prints a combined summary with a coverage score and
    significant gap list.

## Usage

Run from repository root.

```sh
deno run -A .github/skills/gap-analysis/scripts/requirement_test_coverage.ts
```

```sh
deno run -A .github/skills/gap-analysis/scripts/rfc_requirement_coverage.ts
```

```sh
deno run -A .github/skills/gap-analysis/scripts/full_gap_analysis.ts
```

Scope-filtered examples:

```sh
# Account-focused gap analysis
deno run -A .github/skills/gap-analysis/scripts/full_gap_analysis.ts --scope account
```

```sh
# Domain-admin-focused RFC coverage
deno run -A .github/skills/gap-analysis/scripts/rfc_requirement_coverage.ts --scope domain-admin
```

```sh
# Listener-tool RFC coverage
deno run -A .github/skills/gap-analysis/scripts/rfc_requirement_coverage.ts --scope listener
```

Optional machine-readable output:

```sh
deno run -A .github/skills/gap-analysis/scripts/full_gap_analysis.ts --json
```

Optional requirements path filter:

```sh
deno run -A .github/skills/gap-analysis/scripts/full_gap_analysis.ts --requirements-prefix account
```

Supported `--scope` values:

- `all` (default)
- `account` (RFC identity tools; defaults requirements prefix to `account`)
- `domain-admin` / `domain` (RFC domain-management tools)
- `listener` (RFC listener tools: Sections 10B.1 through 10B.6)

## Output conventions

- Coverage score format: `X/Y requirements covered by tests (Z%)`
- The report MUST be written to `spec/reports/gap-analysis-report.md`,
  replacing any prior contents (per `general.instructions.md` § Analysis
  Reports). Each run overwrites the file; do not append or version the name.
- `.tmp/` is reserved for intermediate script output (e.g. `--json`) only,
  never the report itself.

### Report layout

The report has these sections in this order:

1. Header with overall coverage scores (requirement→test and RFC→requirement).
2. Summary tables (one per analysis dimension).
3. **Action Items** — agent-actionable checkboxes (described below).

### Action Items section (checkbox list — primary output)

This is the section an agent works through. Each item is one atomic, fixable
unit, expressed as a single `- [ ]` task. Group by gap kind, in this order:

1. Missing requirement test files
2. Requirement IDs not referenced by any test
3. Orphan tests without a paired requirement doc
4. RFC tools without a corresponding requirement doc

Item template (one per missing test file):

```markdown
- [ ] **Missing test file**: `invitations-009` — Senders can cancel a direct invitation
      **Doc**: [.github/requirements/invitations/009-cancel-invitation.requirement.md](.github/requirements/invitations/009-cancel-invitation.requirement.md)
      **Create**: `src/requirements/invitations/009-cancel-invitation.requirement.test.ts`
      **Top-level test name**: `req:invitations-009 - Senders can cancel a direct invitation`
```

Item template (one per uncovered RFC tool):

```markdown
- [ ] **Missing requirement doc**: RFC tool `cancel_invitation` (Section 10B.3) is not represented in `.github/requirements/`
      **Action**: ask the user whether to add a requirement doc; if yes, create
      `.github/requirements/<category>/<NNN>-<slug>.requirement.md` with frontmatter `id` and `title`, then re-run gap-analysis.
```

Wording rules:

- ✅ Each gap is its own checkbox; never bundle multiple gaps under one bullet.
- ✅ Always supply the exact path the agent should create or open.
- ❌ Never use whole-feature framing such as "the messages feature is missing"
  when individual files are countable; list each missing file as its own item.
- ❌ Do not place checkboxes inside the summary tables — tables are read-only
  summaries; checkboxes belong in § Action Items.

### Working a report

The agent's loop when asked to close gap-analysis findings:

1. Open `spec/reports/gap-analysis-report.md`.
2. Find the first unchecked `- [ ]` in § Action Items.
3. Perform the action (create the named file, add the named test, etc.).
4. For new test files: include the top-level `Deno.test("req:<id> - ...")`
   exactly as listed.
5. Mark the box `- [x]` and move on.

Significant gaps that this report captures (each becomes one or more checkbox
items):

- requirement docs missing mirrored tests
- orphan requirement tests without docs
- requirement IDs not covered by tests
- RFC tools missing requirement representation
