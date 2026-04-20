import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../../test-helpers.ts";

Deno.test({
  name: "req:mcp-auth-003 - Bearer token is supplied only in Authorization header",
  fn: async (t) => {
    await withStartedServer(async () => {
      await t.step("server starts and becomes healthy", async () => {
        const res = await fetch("http://localhost:8000/health");
        assertEquals(res.status, 200);
        const body = await res.json();
        assertEquals(body.ok, true);
      });

      await t.step("rejects token passed as query parameter", async () => {
        const response = await fetch(
          "http://localhost:8000/mcp?access_token=fake-token",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({}),
          },
        );

        assertEquals(response.status, 401);
        assertExists(response.headers.get("WWW-Authenticate"));

        const body = await response.json();
        assertEquals(body.code, "MISSING_HEADER");
      });

      await t.step("rejects token passed in request body", async () => {
        const response = await fetch("http://localhost:8000/mcp", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ access_token: "fake-token" }),
        });

        assertEquals(response.status, 401);
        assertExists(response.headers.get("WWW-Authenticate"));

        const body = await response.json();
        assertEquals(body.code, "MISSING_HEADER");
      });

      await t.step("accepts only Bearer scheme in Authorization header", async () => {
        const response = await fetch("http://localhost:8000/mcp", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: "Bearer fake-token",
          },
          body: JSON.stringify({}),
        });

        assertEquals(response.status, 401);
        assertExists(response.headers.get("WWW-Authenticate"));

        const body = await response.json();
        assertEquals(body.code, "INVALID_TOKEN_FORMAT");
      });

      await t.step("requires Authorization header on each request", async () => {
        const first = await fetch("http://localhost:8000/mcp", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        });
        assertEquals(first.status, 401);
        await first.text();

        const second = await fetch("http://localhost:8000/mcp", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        });
        assertEquals(second.status, 401);

        const secondBody = await second.json();
        assertEquals(secondBody.code, "MISSING_HEADER");
      });
    });
  },
});
