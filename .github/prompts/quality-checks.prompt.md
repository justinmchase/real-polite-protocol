---
description: "Run the full quality gate: format, lint, dependency audit, all tests, all scenarios, gap analysis, and evaluation report."
---

# /quality-checks

Run every quality gate in order. Stop and report if any gate fails hard
(non-zero exit from a shell command or a scenario FAIL with no recoverable
action). Soft issues (outdated deps, partial coverage) are reported but do not
halt the run.

---

## 1. Format

```sh
deno fmt --check
```

If the check reports unformatted files, run `deno fmt` to fix them, then re-run
`deno fmt --check` to confirm clean. Report any files that were reformatted.

---

## 2. Lint

```sh
deno lint
```

Report all warnings and errors. Lint errors are a hard stop — do not proceed
until they are resolved.

---

## 3. Outdated dependencies

```sh
deno outdated
```

List any packages that have newer versions available. This is informational
only; do not auto-upgrade. Summarise the outdated packages in the final report.

---

## 4. Tests

```sh
deno task test
```

Run the full test suite. Report total passed / failed / skipped. Any test
failure is a hard stop.

---

## 5. Scenarios

Invoke the `/run-scenarios` prompt. Follow its execution protocol exactly: stop
the server, reset `.data/`, start the server, confirm MCP connection, then
execute each scenario file under `.github/scenarios/`. Report PASS / FAIL per
scenario and a batch summary.

---

## 6. Gap analysis

Run the full gap analysis and overwrite `spec/reports/gap-analysis-report.md`:

```sh
deno run -A .github/skills/gap-analysis/scripts/full_gap_analysis.ts
```

Report the coverage score (`X/Y requirements covered by tests (Z%)`) and any
significant new gaps.

---

## 7. Evaluation report

Run the semantic closure evaluation and overwrite
`spec/reports/evaluate-report.md`:

```sh
deno run -A .github/skills/evaluate/scripts/extract.ts > .tmp/evaluate.json
```

Then score each statement against its test steps following the evaluate skill
procedure and write the updated report to `spec/reports/evaluate-report.md`.
Report the overall statement-weighted coverage score and any new unchecked
action items.

---

## Final summary

After all gates complete, print a single summary table:

| Gate          | Result  | Notes                           |
| ------------- | ------- | ------------------------------- |
| Format        | ✅ / ❌ | files reformatted (if any)      |
| Lint          | ✅ / ❌ | error/warning count             |
| Outdated deps | ℹ️      | packages with updates available |
| Tests         | ✅ / ❌ | X passed / Y failed             |
| Scenarios     | ✅ / ❌ | X passed / Y failed             |
| Gap analysis  | ✅ / ℹ️ | coverage score                  |
| Evaluate      | ✅ / ℹ️ | statement-weighted score        |
