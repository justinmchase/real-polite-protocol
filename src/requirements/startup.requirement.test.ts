import { assertEquals } from "@std/assert";
import { withStartedServer } from "./test-helpers.ts";

Deno.test({
  name: "req:startup-001 - Application starts without error",
  fn: async (t) => {
    await withStartedServer(async () => {
      await t.step("server starts and responds to health check", async () => {
        const res = await fetch("http://localhost:8000/health");
        assertEquals(res.status, 200);
        const body = await res.json();
        assertEquals(body.ok, true);
      });
    });
  },
});
