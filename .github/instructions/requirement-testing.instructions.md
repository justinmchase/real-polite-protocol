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
