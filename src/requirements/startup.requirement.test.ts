import { assertEquals } from "@std/assert";
import { withStartedServer } from "./helpers/with-started-server.ts";

Deno.test({
  name: "req:startup-001 - Application starts without error",
  fn: async (t) => {
    await withStartedServer(async ({ baseUrl }) => {
      await t.step("server starts and responds to health check", async () => {
        const res = await fetch(`${baseUrl}/health`);
        assertEquals(res.status, 200);
        const body = await res.json();
        assertEquals(body.ok, true);
      });
    });
  },
});
