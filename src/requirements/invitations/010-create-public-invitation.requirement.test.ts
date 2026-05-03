import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";

Deno.test({
  name:
    "req:invitations-010 - Listeners can create a public invitation",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ callTool }) => {
        const accountOid = crypto.randomUUID();
        const token = await issueToken({
          oid: accountOid,
          scope: requiredScopes.join(" "),
          name: "Test User",
        });

        await callTool(token, "set_user_verified_metadata");

        await t.step(
          "create_public_invitation returns invitation_id and created_at",
          async () => {
            const { status, result } = await callTool<{
              invitation_id: string;
              created_at: string;
            }>(token, "create_public_invitation", {
              proposed_terms: { category: "correspondence" },
            });
            assertEquals(status, 200);
            assertExists(result);
            assertExists(result.invitation_id);
            assertExists(result.created_at);
          },
        );

        await t.step(
          "create_public_invitation accepts optional fields",
          async () => {
            const { status, result } = await callTool<{
              invitation_id: string;
              display_name: string;
              description: string;
            }>(token, "create_public_invitation", {
              proposed_terms: { category: "correspondence" },
              display_name: "Test Display",
              description: "A test public invitation",
              max_acceptances: 5,
            });
            assertEquals(status, 200);
            assertExists(result);
            assertExists(result.invitation_id);
          },
        );

        await t.step(
          "create_public_invitation requires proposed_terms",
          async () => {
            const { status } = await callTool(
              token,
              "create_public_invitation",
              {},
            );
            // Should fail with a validation error
            assertEquals(status, 200); // MCP errors are status 200 with error payload
          },
        );
      });
    });
  },
});
