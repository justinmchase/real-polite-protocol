---
description: "Agent-driven end-to-end scenario testing system. Use when: creating scenario files, executing scenarios via the /run-scenarios prompt, reporting scenario pass/fail outcomes."
applyTo: "**/*.scenario.test.md"
---

# Scenario-Based Testing

Scenarios are end-to-end tests **executed by an AI agent** using MCP tools and
prompts, not by the Deno test runner. Each scenario is a Markdown document
that defines a sequence of steps and expected outcomes. The agent executes the
steps in order and reports pass or fail with diagnostic detail.

Scenarios complement (but do not replace) requirement tests:

- Requirement tests verify normative behavior at the controller / manager / HTTP
  level using `Deno.test()`.
- Scenarios verify whole-system, agent-driven flows (MCP tool sequences,
  multi-step user journeys) where the failure modes are interaction-shaped
  rather than assertion-shaped.

## Authority

Scenarios sit BELOW requirement tests in the authority chain:

1. RFC/spec (`spec/rpp-spec.md`)
2. Requirement documents (`.github/requirements/**`)
3. Requirement tests (`src/requirements/**`)
4. **Scenarios (`.github/scenarios/**`)**
5. Implementation code (`src/**`)

Scenarios MUST NOT contradict higher-authority artifacts. If a scenario fails
because the implementation conflicts with a higher-authority artifact, fix the
implementation — do not weaken the scenario.

## Structure

```
.github/scenarios/
  {name}.scenario.test.md             # top-level scenario
  {topic}/
    {name}.scenario.test.md           # nested scenarios supported
```

## Scenario Document

Scenario files use the `{name}.scenario.test.md` naming pattern.

### Frontmatter

```yaml
---
id: unique-scenario-id
title: Human-readable title
tags: [optional, classification, tags]
---
```

- `id` — Unique scenario identifier (e.g., `self-invite-001`). The agent uses
  this id to label pass/fail output.
- `title` — Short human-readable summary.
- `tags` — Optional list of classification tags (e.g., `invitations`,
  `messages`, `smoke`).

### Body

The body MUST contain two sections in order:

#### `## Steps`

A numbered list of imperative steps the agent should perform. Each step
should be concrete enough to execute via available MCP tools. Reference tool
names, parameter values, and any context the agent needs.

#### `## Expected Outcome`

A description of the final state the system MUST be in after all steps
complete. Include any specific field values, status transitions, or response
shapes that must be observed.

Optional sections (use as needed):

- `## Preconditions` — additional setup beyond the standard "fresh database,
  running server, authenticated agent" baseline.
- `## Notes` — explanation, links to related requirements, known caveats.

## Scenario execution rules

When the agent runs a scenario:

1. **Each step is mandatory.** If a step cannot be executed (tool unavailable,
   missing parameter, etc.), the scenario FAILS at that step.
2. **Errors during a step fail the scenario** unless the step explicitly
   expects an error.
3. **If the final state deviates from the expected outcome, the scenario
   FAILS.** Report the actual vs expected state.
4. **Continue running remaining scenarios after a failure.** Do not abort the
   batch.
5. **Report cause and recommendation** for every failure: which step failed,
   what was observed, and the most likely fix.

## Pass/fail output format

Per-scenario:

```
PASS req:<id> — <title>
FAIL req:<id> — <title>
  step <n>: <step summary>
  observed: <what actually happened>
  expected: <what was required>
  recommendation: <suggested fix>
```

Batch summary:

```
Scenarios: <total>  Passed: <p>  Failed: <f>
```

Followed by a list of failed scenario ids with one-line cause summaries.

## Authoring guidelines

- Steps should be deterministic. Avoid time-dependent or order-sensitive
  language unless that is the behavior under test.
- Prefer self-contained scenarios. Each scenario assumes a freshly-started
  server and a clean database (the runner enforces this).
- If a scenario depends on data created by a prior step, state that
  dependency explicitly within the scenario — never across scenarios.
- Reference the relevant requirement id(s) in `## Notes` so reviewers can
  trace scenario coverage back to normative behavior.

## Avoiding tautological scenarios

Scenarios MUST exercise behavior, not just assert that tools exist. Reject:

- Steps that only list tool names without invoking them.
- Expected outcomes that restate the step verbatim ("expected: the tool was
  called").
- Scenarios with no observable end-state (no listing, no read, no get).

A good scenario ends by **reading back state** (e.g., `list_messages`,
`get_message`, `list_invitations`) and asserting concrete field values.
