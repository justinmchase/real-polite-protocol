---
name: evaluate
description: "Semantic closure analysis between requirement docs and requirement tests. Use when: evaluating how thoroughly tests cover the *meaning* of each requirement (not just the existence of a test file), scoring per-requirement / per-category / overall coverage, and producing concrete suggestions for new or modified test steps to close semantic gaps. Complements gap-analysis (which only checks file/ID pairing) by judging behavior coverage."
argument-hint: "[--scope <category>] [--json]"
---

# Evaluate — Requirement ↔ Test Semantic Closure

This skill answers a different question than `gap-analysis`:

| Skill          | Question                                                                       |
| -------------- | ------------------------------------------------------------------------------ |
| `gap-analysis` | Does a test file exist for each requirement doc? (deterministic)               |
| `evaluate`     | Do those tests actually exercise the _normative claims_ in the doc? (semantic) |

A requirement test file passing `gap-analysis` can still leave many MUST/SHOULD
statements unverified. This skill makes that visible and actionable.

## Reporting goal

The report's **primary purpose is to drive incremental coverage closure**. An
agent must be able to walk the report top-to-bottom and, for each unchecked
checkbox, add one test step without further reasoning about the requirement.

Two principles:

1. **Item granularity = one normative statement.** Never group multiple
   uncovered statements behind a single bullet. Every statement that scores
   `0.0` or `0.5` becomes its own checkbox.
2. **Framing describes sub-areas, not whole requirements.** Even when a
   requirement scores 0.0 overall, the report MUST describe the missing
   coverage as "statements within this requirement that have no exercising
   test step", NOT as "the entire requirement is untested" or "completely
   untested". The sole exception is when the test file itself does not exist
   on disk (handled separately, see § Missing test files).

## When to Use

- Before declaring a requirement "done"
- After landing a new feature, to find under-tested edge cases
- During quarterly spec audits
- When the user asks "how well are requirements tested" / "is X covered" /
  "what's missing in the tests"

## Procedure

### 1. Run the extractor

```sh
deno run -A .github/skills/evaluate/scripts/extract.ts > .tmp/evaluate.json
```

This emits a JSON document of the form:

```jsonc
{
  "categories": [
    {
      "name": "receptive-policy",
      "requirements": [
        {
          "id": "receptive-policy-007",
          "title": "Receptive windows expose a shareable shortcode",
          "doc_path": ".github/requirements/receptive-policy/007-...md",
          "test_path": "src/requirements/receptive-policy/007-...test.ts",
          "statements": [
            "The shortcode MUST be exactly 8 characters drawn from [a-z0-9].",
            "When a shortcode is provided, the server MUST resolve it before applying policy validation."
            // ...
          ],
          "test_steps": [
            "open_receptive_window response includes a shortcode field",
            "shortcode is exactly 8 lowercase alphanumeric characters"
            // ...
          ]
        }
      ]
    }
  ]
}
```

The extractor pulls:

- **Statements**: every normative bullet from the requirement doc — lines
  starting with `-` that contain MUST / MUST NOT / SHOULD / SHOULD NOT / MAY /
  REQUIRED. Continuation lines (indented) are appended to the prior statement.
- **Test steps**: the string literal first argument to every
  `t.step("...", ...)` call in the paired test file.

### 2. Score each statement

Read the JSON. For every requirement, walk its `statements` and assign each one
a coverage value by judging whether any `test_steps` exercise it:

| Score | Label     | Definition                                                                                                                                                                                               |
| ----- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `1.0` | Covered   | A test step name (and, by inference, its assertions) clearly exercises the exact behavior asserted in the statement.                                                                                     |
| `0.5` | Partial   | A test step touches related behavior but does not fully verify the claim (e.g. happy-path only when statement is about an error path; verifies presence but not value; tests one of N enumerated cases). |
| `0.0` | Uncovered | No test step plausibly exercises this statement.                                                                                                                                                         |

When in doubt about whether a step's name truly covers a statement, open the
test file and read its assertions before scoring. Do NOT inflate scores from
filenames alone.

### 3. Aggregate

- **Per-requirement score** = mean of statement scores (0.0 — 1.0).
- **Per-category score** = mean of requirement scores in that directory (e.g.
  `account/`, `messages/`, `receptive-policy/`).
- **Overall score** = mean of all requirement scores, plus a statement-weighted
  variant (sum of statement scores / total statements) to reduce the bias from
  short requirements.

Emit both the unweighted and weighted overall numbers.

### 4. Report

Write the report to `spec/reports/evaluate-report.md`, replacing any prior
contents (per `general.instructions.md` § Analysis Reports).

The report has these sections in this order:

1. Header with overall + statement-weighted percentages and a "How to use"
   pointer to § Action Items.
2. By-category table.
3. By-requirement table (no checkboxes here — purely informational).
4. **Action Items** — the agent-actionable list (checkboxes here).
5. Missing test files (if any).

#### 4a. Header and tables

```markdown
# Semantic Closure Evaluation Report

**Scope**: all
**Methodology**: Statement-level semantic scoring — 1.0 covered · 0.5 partial · 0.0 uncovered
**How to use this report**: Each unchecked box in § Action Items represents one
missing or weak test step. Work top-to-bottom; mark `[x]` when the
corresponding test step has been added and is passing.

## Overall

| Metric                              | Score              |
| ----------------------------------- | ------------------ |
| Requirements fully covered (≥ 0.80) | A / N (P%)         |
| Requirements partially covered      | B / N (P%)         |
| Requirements with no covered steps  | C / N (P%)         |
| **Statement-weighted coverage**     | **S / T = P%**     |

## By Category

| Category | Reqs | Stmts | Stmt-wt% | Covered ≥0.80 | Partial | Uncovered |
| -------- | ---- | ----- | -------- | ------------- | ------- | --------- |
| ...      | ...  | ...   | ...      | ...           | ...     | ...       |

## By Requirement

| ID  | Title | Score | Stmts (✓ / ⚠ / ✗) | Notes                                  |
| --- | ----- | ----- | ------------------ | -------------------------------------- |
| ... | ...   | 0.63  | 5 / 2 / 1          | 3 statements need additional coverage  |
| ... | ...   | 0.00  | 0 / 0 / 6          | 6 statements need test coverage        |
```

**Wording rules for the By-Requirement Notes column**:

- ✅ Use: `"<N> statements need additional coverage"`,
  `"<N> statements need test coverage"`, `"fully covered"`,
  `"test file missing — see § Missing test files"`.
- ❌ Never use: `"completely untested"`, `"NO TEST FILE"` (in the table —
  reserved for the dedicated section), `"entire requirement"`,
  `"all behavior missing"`. These mislead readers into thinking the
  requirement itself is unrepresented when in fact it has a test file with
  partial steps, or its statements simply aren't fully exercised yet.

#### 4b. Action Items (checkbox list — primary output)

This is the section an agent works through. Each item is exactly one normative
statement that scored `0.0` or `0.5`, expressed as a single `- [ ]` task.

Group items by requirement id, ordered by category then requirement id within
each category. Order categories by ascending statement-weighted coverage so the
weakest areas come first.

For each requirement that has at least one unchecked statement, emit a
sub-section with the following template:

```markdown
### messages-001 — Listeners can send messages using a held receipt

File: [src/requirements/messages/001-send-message.requirement.test.ts](src/requirements/messages/001-send-message.requirement.test.ts)
Score: 0.50 · Statements: 5 ✓ / 2 ⚠ / 1 ✗

- [ ] **Statement** (✗ uncovered): "The server MUST generate a UUIDv7 `message_id` and ensure `(sender_domain, message_id)` is unique per the local sender domain."
      **Add step**: `await t.step("send_message generates a UUIDv7 message_id unique per sender_domain", ...)`
      **Assert**: returned `message_id` parses as UUIDv7 (timestamp prefix decodes to a value within ±5s of `Date.now()`); a second `send_message` with the same args returns a distinct `message_id`.
      **Spec ref**: requirement bullet 6 (Section 7.1).

- [ ] **Statement** (⚠ partial — happy path only): "If the receiver returns a non-2xx response, the tool MUST surface a structured error to the caller including the receiver's error code when available."
      **Add step**: `await t.step("send_message surfaces receiver error code on 4xx response", ...)`
      **Assert**: with `withFailingCallbackServer` returning 422 + `{ error: { code: "E_RECEIVER_REJECTED" } }`, tool result has `ok: false`, `error.code === "E_RECEIVER_REJECTED"`.
      **Spec ref**: requirement bullet 9.
```

Wording rules for action items:

- ✅ Mark uncovered statements `**Statement** (✗ uncovered)`.
- ✅ Mark partial statements `**Statement** (⚠ partial — <one-line reason>)`.
- ✅ Quote the statement verbatim from the requirement doc so an agent can match
  it back without reasoning.
- ✅ Provide the literal `t.step("...", ...)` shell so an agent can paste it.
- ✅ Provide one `**Assert**:` line stating the exact value, error code, or
  shape to verify.
- ✅ Provide a `**Spec ref**:` line citing the bullet number or RFC section so
  the agent can confirm against higher authority.
- ❌ Never aggregate two statements into one bullet, even if they live next to
  each other in the doc.
- ❌ Never use vague phrasing like "test more cases" or
  "improve coverage of error paths" — every checkbox is a single concrete step.
- ❌ Never frame an item as "the requirement is untested" — the item is about
  one specific statement within a requirement that already has (or should have)
  a test file.

#### 4c. Missing test files

Reserved exclusively for requirements whose paired `*.requirement.test.ts`
file does not exist on disk. This is the only place where a whole-requirement
framing is correct.

```markdown
## Missing test files

These requirements have no paired test file. Create the file and seed it with
the action items listed for this requirement above (if any), or — when no
statements have been scored because the doc was unreachable — see
`gap-analysis-report.md`.

- [ ] `invitations-009` — create `src/requirements/invitations/009-cancel-invitation.requirement.test.ts`
- [ ] ...
```

If there are no missing files, write `_None._` under the heading.

### 5. Working a report

When asked to "close gaps", "improve coverage", or "work through the report",
the agent's loop is:

1. Open `spec/reports/evaluate-report.md`.
2. Find the first unchecked `- [ ]` in § Action Items.
3. Open the test file referenced in that requirement's heading.
4. Add exactly the `t.step` shown, with assertions matching the `**Assert**`
   line. Quote the `**Statement**` text in a comment above the step so the
   provenance is preserved.
5. Run that test file (`deno test --allow-all <path>`); fix until green.
6. Mark the box `- [x]` in the report.
7. Repeat.

The report is the source of truth for what's outstanding; once all boxes are
checked the run is complete and the skill should be re-run to recompute scores.

## Scope filtering

When the user specifies a category (e.g. "evaluate the messages requirements"),
pass `--scope <category>` to the extractor. The extractor filters by the
top-level directory under `.github/requirements/`.

```sh
deno run -A .github/skills/evaluate/scripts/extract.ts --scope messages > .tmp/evaluate.json
```

## Output location

Per `general.instructions.md` § Analysis Reports:

- The report MUST be written to `spec/reports/evaluate-report.md`.
- Each run replaces the previous file. Do not append; do not version the file
  name. Git history is the run history.
- `.tmp/` is reserved for the intermediate extractor JSON only — never the
  report itself.

## Authority reminder

Per repo `general.instructions.md`, the authority order is RFC → requirement
docs → tests → code. This skill compares **only** requirements ↔ tests. If a
test fully passes its requirement but the requirement itself misses RFC
behavior, run `gap-analysis` instead — that's the lower-authority gap.

## Anti-patterns

- **Scoring from filename pairing alone.** That's `gap-analysis`. This skill
  must inspect _content_.
- **Counting non-normative bullets.** Skip prose like "This is RECOMMENDED for
  proximity pairing" used as flavor text — only count testable claims.
- **Vague suggestions.** "Add more tests" is useless. Always propose a specific
  step name and assertion.
- **Over-counting MAY statements.** `MAY` clauses describe optional behavior; if
  no test exercises the option, that's _partial_, not uncovered, since the spec
  does not require the behavior to be implemented.
- **Whole-requirement framing.** Phrases like "completely untested",
  "no tests for this requirement", or bullet lists summarising several missing
  behaviors under a single item defeat the report's purpose. The report exists
  to enumerate atomic, checkbox-sized tasks. The only valid place to talk about
  a whole requirement having no tests is § Missing test files, and only when
  the test file genuinely does not exist on disk.
- **Checkboxes outside § Action Items.** Do not add `- [ ]` to the by-category
  or by-requirement tables. Checkboxes are reserved for atomic, executable
  tasks; the tables are summaries, not work items.
