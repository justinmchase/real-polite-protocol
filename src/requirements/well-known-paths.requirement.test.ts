// req:well-known-001 — Domain identity well-known endpoint.
//
// Tests that GET /.well-known/rpp-domain-identity returns the required domain
// identity document with no authentication, correct status, and all REQUIRED
// fields.

import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "./helpers/with-started-server.ts";

Deno.test({
  name: "req:well-known-001 - Domain identity well-known endpoint",
  fn: async (t) => {
    await withStartedServer(async ({ baseUrl }) => {
      const url = `${baseUrl}/.well-known/rpp-domain-identity`;

      await t.step(
        "responds with HTTP 200 and no authentication required",
        async () => {
          const response = await fetch(url, { method: "GET" });
          assertEquals(response.status, 200);
          await response.body?.cancel();
        },
      );

      await t.step("Content-Type is application/json", async () => {
        const response = await fetch(url, { method: "GET" });
        const ct = response.headers.get("content-type") ?? "";
        assertEquals(ct.includes("application/json"), true);
        await response.body?.cancel();
      });

      await t.step(
        "response body is a JSON object with all REQUIRED fields",
        async () => {
          const response = await fetch(url, { method: "GET" });
          const body = await response.json() as Record<string, unknown>;

          // REQUIRED: domain
          assertExists(body.domain);
          assertEquals(typeof body.domain, "string");

          // REQUIRED: display_name
          assertExists(body.display_name);
          assertEquals(typeof body.display_name, "string");

          // REQUIRED: envelope_endpoint — full URL of the envelope endpoint
          assertExists(body.envelope_endpoint);
          assertEquals(typeof body.envelope_endpoint, "string");
          assertEquals(
            (body.envelope_endpoint as string).endsWith("/rpp/v1/envelopes"),
            true,
          );

          // REQUIRED: mcp_endpoint — full URL of the MCP endpoint
          assertExists(body.mcp_endpoint);
          assertEquals(typeof body.mcp_endpoint, "string");
          assertEquals(
            (body.mcp_endpoint as string).endsWith("/mcp"),
            true,
          );
        },
      );
    });
  },
});
