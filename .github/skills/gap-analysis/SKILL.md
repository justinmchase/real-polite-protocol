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
- Significant gaps include:
  - requirement docs missing mirrored tests
  - orphan requirement tests without docs
  - requirement IDs not covered by tests
  - RFC tools missing requirement representation
