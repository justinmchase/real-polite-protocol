import { assertEquals, assertMatch } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { ConfigService } from "../../services/config/config.service.ts";

Deno.test({
  name:
    "req:domain-admin-013 - Domain identity includes port when non-standard",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ callTool, port }) => {
        await t.step(
          "domain identity includes the server port for localhost",
          async () => {
            const token = await issueToken({
              oid: "oid-domain-admin",
              roles: ["domain.admin"],
              scope: requiredScopes.join(" "),
            });

            const { status, body } = await callTool(
              token,
              "get_domain_identity",
            );
            assertEquals(status, 200);

            const result = body.result as {
              content?: Array<{ text?: string }>;
            };
            const text = result.content?.[0]?.text ?? "";
            const identity = JSON.parse(text) as Record<string, unknown>;

            const expectedDomain = `localhost:${port}`;
            assertEquals(
              identity.domain,
              expectedDomain,
              `Expected domain to be "${expectedDomain}" but got "${identity.domain}"`,
            );
          },
        );

        await t.step(
          "domain includes port as part of the authority component",
          async () => {
            const token = await issueToken({
              oid: "oid-domain-admin",
              roles: ["domain.admin"],
              scope: requiredScopes.join(" "),
            });

            const { status, body } = await callTool(
              token,
              "get_domain_identity",
            );
            assertEquals(status, 200);

            const result = body.result as {
              content?: Array<{ text?: string }>;
            };
            const text = result.content?.[0]?.text ?? "";
            const identity = JSON.parse(text) as Record<string, unknown>;
            const domain = identity.domain as string;

            // domain must match host:port pattern for localhost
            assertMatch(domain, /^localhost:\d+$/);
          },
        );
      });
    });
  },
});

// Unit test for ConfigService domain derivation — specifically the port-443 case
// where no port suffix should be appended.
Deno.test({
  name:
    "req:domain-admin-013 (unit) - Domain identity omits port suffix when port is 443",
  fn: async (t) => {
    await t.step(
      "non-localhost host on port 443 uses hostname only (no :443 suffix)",
      () => {
        const config = new ConfigService(
          "example.com",
          443,
          undefined, // kvPath
          "tenant-id",
          "api-app-client-id",
          "client-app-client-id",
          undefined, // issuer
          undefined, // audience
          false, // authDebugLogTokenPayload
          false, // authDebugLogRawAccessToken
        );
        assertEquals(
          config.domain,
          "example.com",
          "Standard HTTPS port (443) must be omitted from domain",
        );
      },
    );

    await t.step(
      "non-localhost host on non-standard port includes port suffix",
      () => {
        const config = new ConfigService(
          "example.com",
          8080,
          undefined,
          "tenant-id",
          "api-app-client-id",
          "client-app-client-id",
          undefined,
          undefined,
          false,
          false,
        );
        assertEquals(config.domain, "example.com:8080");
      },
    );
  },
});
