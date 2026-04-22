import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../../test-helpers.ts";

Deno.test({
  name:
    "req:mcp-auth-003 - Bearer token is supplied only in Authorization header",
  fn: async (t) => {
    await withStartedServer(async ({ baseUrl }) => {
      await t.step("server starts and becomes healthy", async () => {
        const res = await fetch(`${baseUrl}/health`);
        assertEquals(res.status, 200);
        const body = await res.json();
        assertEquals(body.ok, true);
      });

      await t.step("rejects token passed as query parameter", async () => {
        const response = await fetch(
          `${baseUrl}/mcp?access_token=fake-token`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({}),
          },
        );

        assertEquals(response.status, 401);
        assertExists(response.headers.get("WWW-Authenticate"));

        const body = await response.json();
        assertEquals(body.code, "E_MISSING_HEADER");
      });

      await t.step("rejects token passed in request body", async () => {
        const response = await fetch(`${baseUrl}/mcp`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ access_token: "fake-token" }),
        });

        assertEquals(response.status, 401);
        assertExists(response.headers.get("WWW-Authenticate"));

        const body = await response.json();
        assertEquals(body.code, "E_MISSING_HEADER");
      });

      await t.step(
        "accepts only Bearer scheme in Authorization header",
        async () => {
          const response = await fetch(`${baseUrl}/mcp`, {
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
          assertEquals(body.code, "E_INVALID_TOKEN_FORMAT");
        },
      );

      await t.step(
        "requires Authorization header on each request",
        async () => {
          const first = await fetch(`${baseUrl}/mcp`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({}),
          });
          assertEquals(first.status, 401);
          await first.text();

          const second = await fetch(`${baseUrl}/mcp`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({}),
          });
          assertEquals(second.status, 401);

          const secondBody = await second.json();
          assertEquals(secondBody.code, "E_MISSING_HEADER");
        },
      );
    });
  },
});
