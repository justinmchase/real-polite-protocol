import { assertEquals } from "@std/assert";
import { start } from "../../mod.ts";
import { callTool, type ToolCallResult } from "./call-tool.ts";
import {
  callGetPermissions,
  type PermissionLevels,
} from "./call-get-permissions.ts";

export interface StartedServerContext {
  kvPath: string;
  port: number;
  baseUrl: string;
  callTool: <T = unknown>(
    token: string,
    toolName: string,
    args?: Record<string, unknown>,
  ) => Promise<ToolCallResult<T>>;
  callGetPermissions: (
    token: string,
    args?: Record<string, unknown>,
  ) => Promise<PermissionLevels>;
}

function getFreePort(): number {
  const listener = Deno.listen({ port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();
  return port;
}

async function checkHealth(port: number): Promise<boolean> {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://localhost:${port}/health`);
      if (res.ok) {
        const body = await res.json();
        if (body.ok === true) return true;
      }
    } catch {
      // server not ready yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

export async function withStartedServer(
  run: (context: StartedServerContext) => Promise<void>,
): Promise<void> {
  const port = getFreePort();
  const baseUrl = `http://localhost:${port}`;
  const kvDir = await Deno.makeTempDir({ prefix: "rpp-test-kv-" });
  const kvPath = `${kvDir}/kv.sqlite3`;
  const controller = new AbortController();
  const started = start({ signal: controller.signal, kvPath, port });

  const boundCallTool = <T = unknown>(
    token: string,
    toolName: string,
    args: Record<string, unknown> = {},
  ) => callTool<T>(token, toolName, args, baseUrl);

  const boundCallGetPermissions = (
    token: string,
    args: Record<string, unknown> = {},
  ) => callGetPermissions(token, args, baseUrl);

  try {
    const healthy = await checkHealth(port);
    assertEquals(
      healthy,
      true,
      "Server did not become healthy within timeout",
    );

    await run({
      kvPath,
      port,
      baseUrl,
      callTool: boundCallTool,
      callGetPermissions: boundCallGetPermissions,
    });
  } finally {
    controller.abort();
    await started;
    await Deno.remove(kvDir, { recursive: true });
    await new Promise((r) => setTimeout(r, 200));
  }
}
