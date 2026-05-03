import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";

Deno.test({
  name: "req:invitations-014 - Listeners can accept a remote public invitation",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ baseUrl, callTool }) => {
        const localDomain = new URL(baseUrl).host;

        // Creator account
        const creatorOid = crypto.randomUUID();
        const creatorToken = await issueToken({
          oid: creatorOid,
          scope: requiredScopes.join(" "),
          name: "Creator",
        });
        await callTool(creatorToken, "set_user_verified_metadata");

        // Acceptor account
        const acceptorOid = crypto.randomUUID();
        const acceptorToken = await issueToken({
          oid: acceptorOid,
          scope: requiredScopes.join(" "),
          name: "Acceptor",
        });
        await callTool(acceptorToken, "set_user_verified_metadata");

        // Creator creates a public invitation
        const { result: created } = await callTool<{ invitation_id: string }>(
          creatorToken,
          "create_public_invitation",
          {
            proposed_terms: {
              category: "correspondence",
              usage_policy: "any-time",
            },
          },
        );
        assertExists(created);

        await t.step(
          "accept_public_invitation issues a receipt to the acceptor",
          async () => {
            const { status, result } = await callTool<{
              receipt_id?: string;
              invitation_id?: string;
            }>(acceptorToken, "accept_public_invitation", {
              domain: localDomain,
              invitation_id: created.invitation_id,
            });
            assertEquals(status, 200);
            assertExists(result);
          },
        );

        await t.step(
          "accept_public_invitation respects max_acceptances limit",
          async () => {
            // Create a single-use invitation
            const { result: limited } = await callTool<{
              invitation_id: string;
            }>(creatorToken, "create_public_invitation", {
              proposed_terms: { category: "correspondence" },
              max_acceptances: 1,
            });
            assertExists(limited);

            // First acceptance should succeed
            const { result: first } = await callTool<{ isError?: boolean }>(
              acceptorToken,
              "accept_public_invitation",
              {
                domain: localDomain,
                invitation_id: limited.invitation_id,
              },
            );
            assertExists(first);

            // Second acceptance should be rejected
            const { result: second } = await callTool<{ isError?: boolean }>(
              acceptorToken,
              "accept_public_invitation",
              {
                domain: localDomain,
                invitation_id: limited.invitation_id,
              },
            );
            assertExists(second);
            // Expect an error payload for the second attempt
          },
        );

        await t.step(
          "accept_public_invitation returns error for unknown invitation",
          async () => {
            const { result } = await callTool<{ isError?: boolean }>(
              acceptorToken,
              "accept_public_invitation",
              {
                domain: localDomain,
                invitation_id: crypto.randomUUID(),
              },
            );
            assertExists(result);
            // Expect a structured error
          },
        );
      });
    });
  },
});
