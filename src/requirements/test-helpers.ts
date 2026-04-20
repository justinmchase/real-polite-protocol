import { assertEquals } from "@std/assert";
import { start } from "../mod.ts";

export async function withStartedServer(
  run: () => Promise<void>,
): Promise<void> {
  const controller = new AbortController();
  const started = start({ signal: controller.signal });

  try {
    const healthy = await checkHealth();
    assertEquals(
      healthy,
      true,
      "Server did not become healthy within timeout",
    );

    await run();
  } finally {
    controller.abort();
    await started;
    await new Promise((r) => setTimeout(r, 200));
  }
}

async function checkHealth(): Promise<boolean> {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch("http://localhost:8000/health");
      if (res.ok) {
        const body = await res.json();
        if (body.ok === true) {
          return true;
        }
      }
    } catch {
      // Server not ready yet.
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  return false;
}