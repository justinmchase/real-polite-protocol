import { assertEquals } from "@std/assert";
import { withStartedServer } from "../../helpers/with-started-server.ts";

Deno.test({
  name: "req:mcp-auth-008 - MCP endpoint supports cross-origin browser clients",
  fn: async (t) => {
    await withStartedServer(async ({ baseUrl }) => {
      await t.step(
        "OPTIONS preflight succeeds without auth and returns CORS headers",
        async () => {
          const response = await fetch(`${baseUrl}/mcp`, {
            method: "OPTIONS",
            headers: {
              origin: "https://browser.example",
              "access-control-request-method": "POST",
              "access-control-request-headers": "authorization, content-type",
            },
          });

          assertEquals(response.status, 204);
          assertEquals(
            response.headers.get("Access-Control-Allow-Origin"),
            "https://browser.example",
          );
          const allowMethods =
            response.headers.get("Access-Control-Allow-Methods") ?? "";
          assertEquals(allowMethods.includes("POST"), true);
          const allowHeaders =
            response.headers.get("Access-Control-Allow-Headers") ?? "";
          assertEquals(
            allowHeaders.toLowerCase().includes("authorization"),
            true,
          );
          assertEquals(
            allowHeaders.toLowerCase().includes("content-type"),
            true,
          );
          await response.body?.cancel();
        },
      );

      await t.step(
        "cross-origin POST is accepted and CORS headers are present",
        async () => {
          const response = await fetch(`${baseUrl}/mcp`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              origin: "https://browser.example",
            },
            body: JSON.stringify({}),
          });

          // No bearer => 401 from auth, but the request was NOT rejected for
          // its Origin and CORS headers must be set on the error response.
          assertEquals(response.status, 401);
          assertEquals(
            response.headers.get("Access-Control-Allow-Origin"),
            "https://browser.example",
          );
          const exposed =
            response.headers.get("Access-Control-Expose-Headers") ?? "";
          assertEquals(
            exposed.toLowerCase().includes("www-authenticate"),
            true,
          );
          const body = await response.json();
          assertEquals(body.code, "E_MISSING_HEADER");
        },
      );

      await t.step(
        "requests with no Origin header still receive a wildcard CORS header",
        async () => {
          const response = await fetch(`${baseUrl}/mcp`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({}),
          });

          assertEquals(response.status, 401);
          assertEquals(
            response.headers.get("Access-Control-Allow-Origin"),
            "*",
          );
          await response.body?.cancel();
        },
      );
    });
  },
});
