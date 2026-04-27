# Scenarios

End-to-end scenarios executed by an AI agent via the
[/run-scenarios](../prompts/run-scenarios.prompt.md) prompt.

See
[scenario-testing.instructions.md](../instructions/scenario-testing.instructions.md)
for the full authoring spec.

## Layout

```
.github/scenarios/
  {topic}/
    {name}.scenario.test.md
```

Each file is a self-contained agent-runnable test. Files are NOT discovered by
the Deno test runner — they are read and executed by the agent via the
`/run-scenarios` prompt, which resets state between scenarios.

## Running scenarios

In an agent-enabled VS Code chat session, invoke:

```
/run-scenarios
```

The agent will:

1. Stop the running server (if any)
2. Delete `.data/`
3. Start `deno task start`
4. Verify the MCP session is connected and authenticated
5. Execute each scenario in turn
6. Report PASS/FAIL with cause and recommendation per failure
