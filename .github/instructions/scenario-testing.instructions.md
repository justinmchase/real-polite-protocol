---
description: "Code-driven end-to-end scenario testing system. Use when: creating scenario files, writing scenario tests, linking scenarios to test implementations."
applyTo: "**/*.scenario.{md,test.ts}"
---

# Scenario-Based Testing

Scenarios are end-to-end tests that exercise the running RPP server through the
**MCP HTTP endpoint** as one or more authenticated user personas. They are the
multi-user analogue of requirement tests: each scenario is a Markdown document
describing a real-world user journey in plain English, paired with a
`Deno.test()` implementation that drives the server through that journey.

Scenarios complement (but do not replace) requirement tests:

- Requirement tests verify normative behavior at the controller / manager layer,
  usually as a single in-process invocation.
- Scenarios verify whole-system, multi-user journeys (e.g. "Alice opens a
  receptive window; Justin sends her an invitation; Alice accepts and replies
  with a message") by calling MCP tools over HTTP just like a real client.

## Authority

Scenarios sit BELOW requirement tests in the authority chain:

1. RFC/spec (`spec/rpp-spec.md`)
2. Requirement documents (`.github/requirements/**`)
3. Requirement tests (`src/requirements/**`)
4. **Scenarios (`.github/scenarios/**` + `src/scenarios/**`)**
5. Implementation code (`src/**`)

Scenarios MUST NOT contradict higher-authority artifacts. If a scenario fails
because the implementation conflicts with a higher-authority artifact, fix the
implementation — do not weaken the scenario.

## Structure

```
.github/scenarios/
  {name}.scenario.md                  # scenario document (plain English)
  {topic}/
    {name}.scenario.md                # nested scenarios supported

src/scenarios/
  {name}.scenario.test.ts             # test that drives the scenario
  {topic}/
    {name}.scenario.test.ts           # mirrors the document path
```

Mirroring is mandatory: a scenario document at
`.github/scenarios/invitations/self-invite.scenario.md` MUST have its test at
`src/scenarios/invitations/self-invite.scenario.test.ts`.

## Scenario document

Scenario files use the `{name}.scenario.md` naming pattern.

### Frontmatter

```yaml
---
id: unique-scenario-id
title: Human-readable title
personas: [alice, justin]
tags: [optional, classification, tags]
---
```

- `id` — Unique scenario identifier (e.g., `invite-and-reply-001`). The test
  uses this id in the `Deno.test()` name: `scenario:<id> - <title>`.
- `title` — Short human-readable summary.
- `personas` — List of persona names used by the scenario. Each name must be
  loadable via `loadPersona()` (defaults are auto-generated under
  `.dev/users/<name>.json`).
- `tags` — Optional list of classification tags (e.g., `invitations`,
  `messages`, `smoke`).

### Body

The body MUST contain two sections in order:

#### `## Steps`

A numbered list of imperative, persona-prefixed steps written in plain English.
Each step references a real MCP tool name and the data flow between steps (use
names like "the policy_id from step 2" so the test can capture and reuse
values). Example:

```
1. Alice calls `open_receptive_window` with `duration_seconds: 120`. Capture
   the returned `shortcode`.
2. Justin calls `send_invitation` with `receiver_domain` set to the local
   domain, `shortcode` from step 1, and `communication_terms`
   `{ "categories": ["correspondence"], "max_content_rating": "G" }`. Capture
   `invitation_id`.
3. Alice calls `list_invitations` and confirms the invitation from step 2
   appears with `status: "pending"`.
```

#### `## Expected Outcome`

A description of the final observable state after all steps complete. Include
concrete field values, status transitions, and any properties that must be
asserted at the end.

Optional sections:

- `## Preconditions` — additional setup beyond the standard "fresh database,
  running server" baseline.
- `## Notes` — explanation, links to related requirements, known caveats.

## Scenario tests

Each scenario document has a corresponding test file in `src/scenarios/` that
mirrors the document path.

### Test conventions

- File name: `{name}.scenario.test.ts` matching the document.
- Each scenario test file has a single top-level `Deno.test()` whose name starts
  with the scenario id:
  `Deno.test("scenario:invite-and-reply-001 - ...", async (t) => { ... })`.
- Individual operations are grouped under `t.step()` calls within that test, one
  step per `## Steps` entry where practical.
- Use only `Deno.test` with `t.step()`. Do NOT use `describe`/`it`.
- Tests drive the server through HTTP using `PersonaClient` from
  `scripts/dev/persona-client.ts`. They MUST NOT import managers, repositories,
  or controllers directly.
- Tests MUST start a fresh server with an isolated KV store (use the existing
  `withStartedServer` helper or an equivalent) so scenarios do not leak state
  between runs.
- Tests MUST mint persona JWTs via `personaClient(name)` rather than calling
  `mintToken` directly, so multi-persona setup stays consistent with the
  `deno task as` CLI.

### Minimal test shape

```ts
import {
  PersonaClient,
  personaClient,
} from "../../../scripts/dev/persona-client.ts";
import { withStartedServer } from "../helpers/with-started-server.ts";

Deno.test("scenario:invite-and-reply-001 - Alice and Justin exchange an invitation reply", async (t) => {
  await withStartedServer(async () => {
    let alice: PersonaClient;
    let justin: PersonaClient;
    let shortcode: string;
    let invitationId: string;

    await t.step("set up personas", async () => {
      alice = await personaClient("alice");
      justin = await personaClient("justin");
    });

    await t.step("alice opens a receptive window", async () => {
      const w = await alice.call<{ shortcode: string }>(
        "open_receptive_window",
        { duration_seconds: 120 },
      );
      shortcode = w.shortcode;
    });

    await t.step("justin sends an invitation", async () => {
      const r = await justin.call<{ invitation_id: string }>(
        "send_invitation",
        {
          receiver_domain: "localhost:8000",
          shortcode,
          communication_terms: {
            categories: ["correspondence"],
            max_content_rating: "G",
          },
        },
      );
      invitationId = r.invitation_id;
    });

    await t.step("alice sees the pending invitation", async () => {
      const list = await alice.call<
        { invitations: Array<{ invitation_id: string; status: string }> }
      >("list_invitations", { status: "pending" });
      const found = list.invitations.find((i) =>
        i.invitation_id === invitationId
      );
      assert(found, "invitation should appear in alice's pending list");
    });
  });
});
```

## Multi-persona execution

A single scenario test can hold any number of `PersonaClient` instances and
interleave their calls. Each persona uses its own dev-minted JWT and is
authenticated independently by the server. There is no shared client state.

For ad-hoc multi-persona experimentation outside tests, use the `script`
subcommand of `test-user`:

```sh
deno task as script path/to/scenario.json
```

See `scripts/dev/persona-script.ts` for the script schema.

## Running scenarios

Scenario tests run alongside unit and requirement tests via `deno test`. No
extra runner or prompt is needed.

```sh
deno test                       # all tests
deno test src/scenarios/        # scenarios only
```

The server lifecycle is owned by the test (typically via `withStartedServer`).
Scenarios MUST NOT assume a pre-running `deno task start` process.

## Authoring guidelines

- One scenario per real-world user journey. If a scenario file describes more
  than one journey, split it.
- Always end with a read-back step (`list_*`, `get_*`, etc.) that asserts
  concrete state, not just "the call succeeded".
- Capture IDs returned from earlier steps and reuse them — never hardcode IDs.
- Prefer fresh personas (`alice`, `justin`, `bob`, ...) per scenario file. The
  persona files under `.dev/users/` are deterministic, so two scenarios using
  `alice` share the same `oid` but always start against a fresh KV store.
- Reference relevant requirement ids in `## Notes` so reviewers can trace
  scenario coverage back to normative behavior.

## Avoiding tautological scenarios

Reject scenarios that:

- Only assert HTTP 200 / `ok: true` without inspecting the returned state.
- Reuse the same captured value as both the expected and observed assertion
  side.
- Drive only one persona — those belong as requirement tests, not scenarios.
- End without reading state back from the server.
