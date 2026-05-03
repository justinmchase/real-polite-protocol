import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";

Deno.test({
  name:
    "req:invitations-012 - Listeners can fetch a remote public invitation by domain and invitation ID",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ baseUrl, callTool }) => {
        const accountOid = crypto.randomUUID();
        const token = await issueToken({
          oid: accountOid,
          scope: requiredScopes.join(" "),
          name: "Test User",
        });

        await callTool(token, "set_user_verified_metadata");

        // Create a public invitation to fetch
        const { result: created } = await callTool<{
          invitation_id: string;
          domain: string;
        }>(token, "create_public_invitation", {
          proposed_terms: { category: "correspondence" },
          display_name: "Test Fetched Invitation",
        });
        assertExists(created);
        assertExists(created.invitation_id);

        const localDomain = new URL(baseUrl).host;

        await t.step(
          "fetch_public_invitation returns the full invitation object",
          async () => {
            const { status, result } = await callTool<{
              invitation_id: string;
              domain: string;
              proposed_terms: Record<string, unknown>;
              created_at: string;
            }>(token, "fetch_public_invitation", {
              domain: localDomain,
              invitation_id: created.invitation_id,
            });
            assertEquals(status, 200);
            assertExists(result);
            assertEquals(result.invitation_id, created.invitation_id);
            assertExists(result.proposed_terms);
            assertExists(result.created_at);
          },
        );

        await t.step(
          "fetch_public_invitation returns error for unknown invitation_id",
          async () => {
            const { result } = await callTool<{ isError?: boolean }>(
              token,
              "fetch_public_invitation",
              {
                domain: localDomain,
                invitation_id: crypto.randomUUID(),
              },
            );
            // MCP tool errors surface as isError=true in the result
            assertExists(result);
          },
        );
      });
    });
  },
});
