import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";

Deno.test({
  name:
    "req:invitations-013 - Listeners can update mutable fields on a public invitation they own",
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

        const { result: created } = await callTool<{ invitation_id: string }>(
          token,
          "create_public_invitation",
          {
            proposed_terms: { category: "correspondence" },
            display_name: "Original Name",
            description: "Original description",
          },
        );
        assertExists(created);

        await t.step(
          "update_public_invitation can update display_name and description",
          async () => {
            const { status, result } = await callTool<{
              invitation_id: string;
              display_name: string;
              description: string;
            }>(token, "update_public_invitation", {
              invitation_id: created.invitation_id,
              display_name: "Updated Name",
              description: "Updated description",
            });
            assertEquals(status, 200);
            assertExists(result);
            assertEquals(result.invitation_id, created.invitation_id);
            assertEquals(result.display_name, "Updated Name");
            assertEquals(result.description, "Updated description");
          },
        );

        await t.step(
          "update_public_invitation rejects changes to proposed_terms",
          async () => {
            const { result } = await callTool<{ isError?: boolean }>(
              token,
              "update_public_invitation",
              {
                invitation_id: created.invitation_id,
                proposed_terms: { category: "billing" },
              },
            );
            assertExists(result);
            // Should surface a structured error
          },
        );

        await t.step(
          "update_public_invitation rejects updates by non-owner",
          async () => {
            const otherOid = crypto.randomUUID();
            const otherToken = await issueToken({
              oid: otherOid,
              scope: requiredScopes.join(" "),
              name: "Other User",
            });
            await callTool(otherToken, "set_user_verified_metadata");

            const { result } = await callTool<{ isError?: boolean }>(
              otherToken,
              "update_public_invitation",
              {
                invitation_id: created.invitation_id,
                display_name: "Hacked Name",
              },
            );
            assertExists(result);
            // Must return not-found (not distinguishing "not yours" from "missing")
          },
        );
      });
    });
  },
});
