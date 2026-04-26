import { assertEquals, assertMatch } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";

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
