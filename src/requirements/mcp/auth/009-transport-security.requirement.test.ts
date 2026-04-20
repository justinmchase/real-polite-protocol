import { assertEquals } from "@std/assert";
import { stub } from "@std/testing/mock";
import { withStartedServer } from "../../test-helpers.ts";

Deno.test({
  name: "req:mcp-auth-009 - MCP and OAuth endpoints are served over HTTPS",
  fn: async (t) => {
    await withStartedServer(async () => {
      await t.step(
        "uses localhost http endpoints only for local development metadata",
        async () => {
          const response = await fetch(
            "http://localhost:8000/.well-known/oauth-authorization-server",
          );
          assertEquals(response.status, 200);
          const body = await response.json();
          assertEquals(body.issuer.startsWith("http://localhost:"), true);
          assertEquals(
            body.authorization_endpoint.startsWith("http://localhost:"),
            true,
          );
          assertEquals(
            body.token_endpoint.startsWith("http://localhost:"),
            true,
          );
          assertEquals(body.jwks_uri.startsWith("https://"), true);
        },
      );

      await t.step(
        "redirects authorization requests to an https upstream endpoint",
        async () => {
          const response = await fetch(
            "http://localhost:8000/authorize?client_id=test-client&response_type=code&scope=openid&redirect_uri=http://127.0.0.1/callback",
            { redirect: "manual" },
          );

          assertEquals(response.status, 302);
          const location = response.headers.get("location") ?? "";
          assertEquals(
            location.startsWith("https://login.microsoftonline.com/"),
            true,
          );
          await response.text();
        },
      );

      await t.step(
        "sends token exchange to an https upstream endpoint",
        async () => {
          let upstreamUrl = "";
          const originalFetch = globalThis.fetch;
          const fetchStub = stub(
            globalThis,
            "fetch",
            (input: string | URL | Request, init?: RequestInit) => {
              const request = input instanceof Request
                ? input
                : new Request(input, init);
              upstreamUrl = request.url;
              return Promise.resolve(Response.json({ ok: true }));
            },
          );

          try {
            const response = await originalFetch(
              "http://localhost:8000/token",
              {
                method: "POST",
                headers: {
                  "content-type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                  client_id: "test-client",
                  grant_type: "authorization_code",
                }).toString(),
              },
            );
            assertEquals(response.status, 200);
            assertEquals(
              upstreamUrl.startsWith("https://login.microsoftonline.com/"),
              true,
            );
            await response.text();
          } finally {
            fetchStub.restore();
          }
        },
      );
    });
  },
});
