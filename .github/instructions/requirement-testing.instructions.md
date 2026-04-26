---
description: "Requirement-based testing system. Use when: creating requirement files, writing requirement tests, linking requirements to test implementations, understanding the requirement testing workflow."
applyTo: "**/*.requirement.*"
---

# Requirement-Based Testing

This project uses a requirement-based testing system where each requirement is
defined as a Markdown document and verified by a corresponding test file.

## Structure

```
.github/requirements/
  {name}.requirement.md              # requirement document
  subfolder/
    {name}.requirement.md            # nested requirements supported

src/requirements/
  {name}.requirement.test.ts         # test for the requirement
  subfolder/
    {name}.requirement.test.ts       # mirrors the requirement path
```

## Authority and conflict handling

- Apply this strict authority order when implementing or evaluating behavior:
  1. RFC/spec (`spec/rpp-spec.md`)
  2. Requirement documents (`.github/requirements/**`)
  3. Requirement tests (`src/requirements/**`)
  4. Implementation code (`src/**`)
- Tests MUST validate requirement intent and MUST NOT redefine it.
- If existing requirements conflict with user-requested behavior, ask for
  clarification before changing requirements/tests/code.
- Only alter RFC/spec or requirement documents when explicitly directed by the
  user.

## Coverage and gap analysis expectations

- During requirement/test planning or review, perform both analyses:
  - Requirement-to-test coverage: each requirement mapped to meaningful tests.
  - RFC-to-requirement coverage: relevant RFC behaviors represented in
    requirements.
- Report a coverage score when scope includes requirement work, using this
  format: `X/Y requirements covered by tests (Z%)`.
- Call out significant gaps explicitly, including:
  - Missing requirement docs for RFC behavior.
  - Requirement behaviors with no corresponding tests.
  - Weak tests that do not validate normative requirement outcomes.

## Requirement Documents

Requirement files live in `.github/requirements/` and use the
`{name}.requirement.md` naming pattern. Subdirectory nesting is supported for
organizing related requirements.

### Frontmatter

```yaml
---
id: unique-requirement-id
title: Human-readable title
---
```

- `id` — A unique identifier for the requirement (e.g., `startup-001`).
- `title` — A short human-readable summary.

### Body

The body describes the requirement in plain language. It should be clear enough
for both humans and agents to understand the expected behavior. Include:

- What the system should do.
- Any constraints or preconditions.
- Expected outcomes.

## Requirement Tests

Each requirement document has a corresponding test file in `src/requirements/`
that mirrors the path structure of `.github/requirements/`.

| Requirement document                                     | Test file                                                 |
| -------------------------------------------------------- | --------------------------------------------------------- |
| `.github/requirements/startup.requirement.md`            | `src/requirements/startup.requirement.test.ts`            |
| `.github/requirements/messaging/delivery.requirement.md` | `src/requirements/messaging/delivery.requirement.test.ts` |

### Test conventions

- File name: `{name}.requirement.test.ts` matching the requirement document.
- Each requirement test file has a single top-level `Deno.test()` call whose
  name starts with the requirement id:
  `Deno.test("req:startup-001 - ...", async (t) => { ... })`.
- Individual assertions are grouped under `t.step()` calls within that test:
  ```ts
  Deno.test("req:startup-001 - Application starts without error", async (t) => {
    await t.step("executes without error", () => { ... });
    await t.step("is exported from mod", () => { ... });
  });
  ```
- Do NOT use BDD-style `describe`/`it` from `@std/testing/bdd`. Use only
  `Deno.test` with `t.step()`.
- Requirement tests may span multiple components (integration scope). They
  verify system behavior, not individual units.
- Unit tests (`*.test.ts` next to modules) should also exist for focused
  component testing.

## Test Helper Organization

**NEVER place helper functions in test files.** All reusable test helper
functions MUST be placed in `src/requirements/helpers/`, each in its own file
with an appropriately named filename. Test files must contain ONLY `Deno.test()`
calls and imports — no module-level helper functions, closures, or shared
fixtures defined inline.

```
src/requirements/helpers/
  with-started-server.ts        # withStartedServer()
  with-auth-test-context.ts     # withAuthTestContext(), testAudience, etc.
  assert-auth-failure.ts        # assertAuthFailure()
  call-tool.ts                  # callTool()
  submit-message.ts             # submitMessage()
  seed-message.ts               # seedMessage()
  seed-sent-invitation.ts       # seedSentInvitation()
  compute-hmac.ts               # computeHmac()
  ...
```

Rules:

- One helper (function, class, or closely related group) per file.
- Export helpers with named exports; never use default exports for helpers.
- Deduplicate — before creating a new helper, check if an equivalent already
  exists in `src/requirements/helpers/`.
- Import helpers in test files using relative paths, e.g.:
  `import { withStartedServer } from "../helpers/with-started-server.ts";`

## Running tests

All requirement tests run alongside unit tests via:

```sh
deno test
```

No extra configuration is needed — Deno discovers all `*.test.ts` files
automatically.

## Workflow

1. Define the requirement in `.github/requirements/{name}.requirement.md`.
2. Create `src/requirements/{name}.requirement.test.ts` with tests that verify
   the requirement.
3. Implement the feature in `src/` until the requirement test passes.
4. Keep unit tests (`*.test.ts`) next to their modules for focused coverage.

## Avoiding tautological tests

A tautological test is one that passes regardless of whether the system actually
works. These tests give a false sense of correctness and **MUST NOT** be written
or accepted.

### Common tautologies to reject

- **Existence-only checks**: asserting that a function or module exists without
  calling it. If a requirement says "start() MUST execute", the test must
  actually invoke `start()` and observe that it succeeds.
- **Type-only checks**: asserting `typeof fn === "function"` instead of
  exercising the behavior the requirement specifies.
- **Stubbed assertions**: placeholder steps that contain no assert calls or only
  assert hard-coded literals (e.g., `assertEquals(true, true)`).
- **Dead assertions**: assertions on values that are constructed inside the test
  itself rather than produced by the system under test.

### When a test fails

If a requirement test fails, the correct response is to **diagnose and fix the
root cause** — not to weaken the test until it passes. Specifically:

1. Read the error message and stack trace carefully.
2. Investigate configuration, permissions, environment, or missing setup that
   the code or test runner needs (e.g., `--allow-env`, `--unstable-kv`,
   `deno.json` settings).
3. Fix the underlying issue in the code, configuration, or test setup.
4. If the root cause is genuinely unclear after investigation, **ask the user**
   rather than silently weakening the test.

**Never** reduce a test's scope or remove assertions to work around a failure.
The requirement document is the source of truth — the test must faithfully
verify what the requirement states.
