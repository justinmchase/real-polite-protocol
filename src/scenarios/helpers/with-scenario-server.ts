// Scenario test harness: starts the RPP server in dev mode on a free port and
// hands the test a `persona(name)` factory that returns `PersonaClient`
// instances bound to that server.
//
// Usage:
//   await withScenarioServer(async ({ persona, baseUrl }) => {
//     const alice = await persona("alice");
//     const justin = await persona("justin");
//     await alice.call("open_receptive_window", { duration_seconds: 120 });
//     ...
//   });

import { assertEquals } from "@std/assert";
import { start } from "../../mod.ts";
import {
  type PersonaClient,
  personaClient,
} from "../../../scripts/dev/persona-client.ts";

export interface ScenarioServerContext {
  baseUrl: string;
  port: number;
  kvPath: string;
  persona: (name: string) => Promise<PersonaClient>;
}

function getFreePort(): number {
  const listener = Deno.listen({ port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();
  return port;
}

async function waitForHealth(port: number): Promise<boolean> {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://localhost:${port}/health`);
      if (res.ok) {
        const body = await res.json();
        if (body.ok === true) return true;
      }
    } catch {
      // not ready
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

export async function withScenarioServer(
  run: (ctx: ScenarioServerContext) => Promise<void>,
): Promise<void> {
  const prevDevMode = Deno.env.get("RPP_DEV_MODE");
  Deno.env.set("RPP_DEV_MODE", "1");

  const port = getFreePort();
  const baseUrl = `http://localhost:${port}`;
  const kvDir = await Deno.makeTempDir({ prefix: "rpp-scenario-kv-" });
  const kvPath = `${kvDir}/kv.sqlite3`;
  const controller = new AbortController();
  const started = start({ signal: controller.signal, kvPath, port });

  try {
    const healthy = await waitForHealth(port);
    assertEquals(healthy, true, "scenario server did not become healthy");

    const clients = new Map<string, PersonaClient>();
    const persona = async (name: string): Promise<PersonaClient> => {
      const existing = clients.get(name);
      if (existing) return existing;
      const c = await personaClient(name, { server: baseUrl });
      clients.set(name, c);
      return c;
    };

    await run({ baseUrl, port, kvPath, persona });
  } finally {
    controller.abort();
    await started;
    await Deno.remove(kvDir, { recursive: true });
    if (prevDevMode === undefined) Deno.env.delete("RPP_DEV_MODE");
    else Deno.env.set("RPP_DEV_MODE", prevDevMode);
    await new Promise((r) => setTimeout(r, 200));
  }
}
