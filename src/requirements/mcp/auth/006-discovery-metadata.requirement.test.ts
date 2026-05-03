import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../../helpers/with-started-server.ts";

Deno.test({
  name:
    "req:mcp-auth-006 - OAuth discovery metadata is published for MCP authentication",
  fn: async (t) => {
    await withStartedServer(async ({ baseUrl }) => {
      await t.step("serves protected resource metadata", async () => {
        const response = await fetch(
          `${baseUrl}/.well-known/oauth-protected-resource`,
        );
        assertEquals(response.status, 200);

        const body = await response.json();
        assertEquals(body.resource, `${baseUrl}/mcp`);
        assertEquals(Array.isArray(body.authorization_servers), true);
        assertEquals(
          body.authorization_servers.includes(baseUrl),
          true,
        );
        assertEquals(body.bearer_methods_supported.includes("header"), true);
      });

      await t.step(
        "protected resource metadata includes scopes_supported",
        async () => {
          const response = await fetch(
            `${baseUrl}/.well-known/oauth-protected-resource`,
          );
          const body = await response.json();
          assertEquals(Array.isArray(body.scopes_supported), true);
          // Must have at least the two required API scopes (resource-qualified)
          const scopes: string[] = body.scopes_supported;
          assertEquals(
            scopes.some((s) => s.endsWith("/rpp.tools.read")),
            true,
          );
          assertEquals(
            scopes.some((s) => s.endsWith("/rpp.messages.submit")),
            true,
          );
        },
      );

      await t.step(
        "resource-path-suffixed protected resource URL responds",
        async () => {
          const response = await fetch(
            `${baseUrl}/.well-known/oauth-protected-resource/mcp`,
          );
          assertEquals(response.status, 200);
          const body = await response.json();
          assertEquals(body.resource, `${baseUrl}/mcp`);
        },
      );

      await t.step("serves authorization server metadata", async () => {
        const response = await fetch(
          `${baseUrl}/.well-known/oauth-authorization-server`,
        );
        assertEquals(response.status, 200);

        const body = await response.json();
        assertEquals(body.issuer, baseUrl);
        assertEquals(
          body.authorization_endpoint,
          `${baseUrl}/authorize`,
        );
        assertEquals(body.token_endpoint, `${baseUrl}/token`);
        assertEquals(body.resource, `${baseUrl}/mcp`);
        assertEquals(body.response_types_supported.includes("code"), true);
        assertEquals(
          body.code_challenge_methods_supported.includes("S256"),
          true,
        );
      });

      await t.step(
        "authorization server metadata includes registration_endpoint",
        async () => {
          const response = await fetch(
            `${baseUrl}/.well-known/oauth-authorization-server`,
          );
          const body = await response.json();
          assertEquals(body.registration_endpoint, `${baseUrl}/register`);
        },
      );

      await t.step(
        "authorization server scopes_supported has no .default scope",
        async () => {
          const response = await fetch(
            `${baseUrl}/.well-known/oauth-authorization-server`,
          );
          const body = await response.json();
          assertEquals(Array.isArray(body.scopes_supported), true);
          const scopes: string[] = body.scopes_supported;
          // offline_access must be present so refresh tokens work
          assertEquals(scopes.includes("offline_access"), true);
          // .default MUST NOT appear — Azure AD rejects it when combined with
          // resource-specific scopes (AADSTS70011)
          assertEquals(
            scopes.some((s) => s.endsWith("/.default")),
            false,
          );
        },
      );

      await t.step(
        "resource-path-suffixed authorization server URL responds",
        async () => {
          const response = await fetch(
            `${baseUrl}/.well-known/oauth-authorization-server/mcp`,
          );
          assertEquals(response.status, 200);
          const body = await response.json();
          assertEquals(body.issuer, baseUrl);
        },
      );

      await t.step(
        "openid-configuration discovery path responds",
        async () => {
          const response = await fetch(
            `${baseUrl}/.well-known/openid-configuration`,
          );
          assertEquals(response.status, 200);
          const body = await response.json();
          assertEquals(body.issuer, baseUrl);
        },
      );

      await t.step(
        "openid-configuration resource-path-suffixed URL responds",
        async () => {
          const response = await fetch(
            `${baseUrl}/.well-known/openid-configuration/mcp`,
          );
          assertEquals(response.status, 200);
          const body = await response.json();
          assertEquals(body.issuer, baseUrl);
        },
      );

      await t.step(
        "POST /register returns 201 with pre-configured client_id",
        async () => {
          const response = await fetch(`${baseUrl}/register`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              client_name: "Test MCP Client",
              redirect_uris: ["http://localhost:12345/callback"],
              grant_types: ["authorization_code"],
              response_types: ["code"],
            }),
          });
          assertEquals(response.status, 201);
          const body = await response.json();
          assertExists(body.client_id);
          assertEquals(body.token_endpoint_auth_method, "none");
          assertEquals(body.client_secret, undefined);
          assertEquals(
            body.redirect_uris.includes("http://localhost:12345/callback"),
            true,
          );
        },
      );

      await t.step(
        "POST /register succeeds with empty body",
        async () => {
          const response = await fetch(`${baseUrl}/register`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "{}",
          });
          assertEquals(response.status, 201);
          const body = await response.json();
          assertExists(body.client_id);
          assertEquals(body.token_endpoint_auth_method, "none");
        },
      );
    });
  },
});
