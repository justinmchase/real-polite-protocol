import { assertEquals } from "@std/assert";
import { start } from "../mod.ts";

Deno.test({
  name: "req:startup-001 - Application starts without error",
  fn: async (t) => {
    await t.step("server starts and responds to health check", async () => {
      const controller = new AbortController();
      const started = start({ signal: controller.signal });
      const healthy = await checkHealth(controller);
      await started;
      assertEquals(
        healthy,
        true,
        "Server did not become healthy within timeout",
      );
    });
  },
});

async function checkHealth(controller: AbortController): Promise<boolean> {
  let healthy = false;
  try{
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch("http://localhost:8000/health");
        if (res.ok) {
          const body = await res.json();
          assertEquals(body.ok, true);
          healthy = true;
          break;
        }
      } catch {
        // Server not ready yet
      }
      await new Promise((r) => setTimeout(r, 200));
    }
  } finally {
    controller.abort();
    await new Promise((r) => setTimeout(r, 200));
  }

  return healthy;
}
