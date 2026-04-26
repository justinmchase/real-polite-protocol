---
agent: agent
model: [Claude Opus 4.6]
description: "Run all end-to-end scenarios defined under .github/scenarios/. Executes each scenario from a clean state and reports pass/fail with diagnostic detail."
---

# /run-scenarios

You are about to execute the project's end-to-end scenarios as an interactive
agent. Each scenario lives under `.github/scenarios/**/*.scenario.test.md` and
is governed by the rules in
[scenario-testing.instructions.md](../instructions/scenario-testing.instructions.md).

## Goals

1. Run every scenario file under `.github/scenarios/` from a clean,
   reproducible state.
2. Report PASS or FAIL for each scenario, with concrete cause and
   recommendation on failure.
3. Continue past failures and produce a final batch summary.

## Execution protocol

For **each** scenario file, in this exact order:

### 1. Stop the running server

If a `deno task start` terminal exists, stop it. The server MUST NOT be
running before the next step.

### 2. Reset the database

Delete the `.data/` directory:

```sh
rm -rf .data/
```

### 3. Start the server

Run `deno task start` in a background terminal. Wait until the server logs
indicate it is listening (e.g. `Listening on http://0.0.0.0:8000`).

### 4. Confirm MCP connection

Verify the Copilot MCP client is connected to the local RPP MCP server. If the
session is not connected, or if the bearer token has expired, **stop and ask
the user** to:

- log in (or refresh the token), or
- restart the MCP client / VS Code window,

then resume from this scenario.

Do not skip this step — scenarios depend on authenticated MCP tool calls.

### 5. Execute the scenario

Read the scenario file. Perform each step in `## Steps` in order using MCP
tools. After all steps complete (or as soon as one cannot be executed), verify
the final system state against `## Expected Outcome`.

Record the result:

- **PASS** if every step executed and the final state matches the expected
  outcome.
- **FAIL** if any step could not be executed, raised an unexpected error, or
  the final state deviates from the expected outcome.

For FAIL, capture: which step failed, observed state, expected state, and a
recommended fix.

### 6. Continue to the next scenario

Even if the current scenario failed, return to step 1 and run the next
scenario. Do not abort the batch.

### 7. Final cleanup

After the last scenario has been executed (whether it passed or failed),
leave the workspace in a clean state:

1. Stop any running `deno task start` terminal started by this batch.
2. Delete the `.data/` directory:

   ```sh
   rm -rf .data/
   ```

This step runs exactly once at the end of the batch, regardless of pass/fail
results. Do this **before** printing the final report.

## Final report

After all scenarios complete, print:

```
Scenarios: <total>  Passed: <p>  Failed: <f>

PASS <id> — <title>
PASS <id> — <title>
FAIL <id> — <title>
  step <n>: <summary>
  observed: <what happened>
  expected: <what the scenario required>
  recommendation: <suggested fix>
...
```

Group failures at the end of the report and recommend root-cause fixes where
multiple scenarios share a cause.

## Important constraints

- Do NOT modify scenario files to make them pass.
- Do NOT skip the database reset between scenarios.
- Do NOT run scenarios in parallel — they share the local server and KV store.
- If the server fails to start (port in use, build error, etc.), report a
  setup failure and stop the batch — scenarios cannot run without it.
- All non-trivial commands run in the terminal must be explained briefly before
  execution, per project conventions.
