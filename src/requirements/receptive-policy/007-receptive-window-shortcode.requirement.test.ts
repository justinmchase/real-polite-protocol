import { assertEquals, assertExists, assertMatch } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";

const TERMS = {
  categories: ["correspondence"],
  max_content_rating: "PG",
} as const;

Deno.test({
  name:
    "req:receptive-policy-007 - Receptive windows expose a shareable shortcode",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ port, callTool }) => {
        const serverHost = `localhost:${port}`;

        const listenerToken = await issueToken({
          oid: crypto.randomUUID(),
          scope: requiredScopes.join(" "),
          name: "Listener",
        });
        await callTool(listenerToken, "set_user_verified_metadata");

        const senderToken = await issueToken({
          oid: crypto.randomUUID(),
          scope: requiredScopes.join(" "),
          name: "Sender",
        });
        await callTool(senderToken, "set_user_verified_metadata");

        await t.step("response includes shortcode + domain", async () => {
          const { result } = await callTool<{
            shortcode: string;
            domain: string;
          }>(listenerToken, "open_receptive_window", { duration_seconds: 120 });
          assertExists(result);
          assertExists(result.shortcode);
          assertExists(result.domain);
          assertEquals(result.domain, serverHost);
        });

        await t.step(
          "shortcode is 8 lowercase alphanumeric chars",
          async () => {
            const { result } = await callTool<{ shortcode: string }>(
              listenerToken,
              "open_receptive_window",
              { duration_seconds: 120 },
            );
            assertExists(result);
            assertMatch(result.shortcode, /^[a-z0-9]{8}$/);
          },
        );

        await t.step(
          "five concurrently-opened windows have unique shortcodes",
          async () => {
            const codes: string[] = [];
            for (let i = 0; i < 5; i++) {
              const { result } = await callTool<{ shortcode: string }>(
                listenerToken,
                "open_receptive_window",
                { duration_seconds: 120 },
              );
              assertExists(result);
              codes.push(result.shortcode);
            }
            assertEquals(new Set(codes).size, 5);
          },
        );

        await t.step(
          "send_invitation with shortcode delivers via x-rpp-shortcode header",
          async () => {
            const { result: w } = await callTool<{ shortcode: string }>(
              listenerToken,
              "open_receptive_window",
              { duration_seconds: 120 },
            );
            assertExists(w);
            const { result } = await callTool<{ invitation_id: string }>(
              senderToken,
              "send_invitation",
              {
                receiver_domain: serverHost,
                shortcode: w.shortcode,
                communication_terms: TERMS,
              },
            );
            assertExists(result);
            assertExists(result.invitation_id);
          },
        );

        await t.step("unknown shortcode is rejected", async () => {
          const { result, body } = await callTool(
            senderToken,
            "send_invitation",
            {
              receiver_domain: serverHost,
              shortcode: "00000000",
              communication_terms: TERMS,
            },
          );
          const errorish =
            (result as { ok?: boolean } | undefined)?.ok === false ||
            body.error !== undefined || result === undefined;
          assertEquals(errorish, true);
        });

        await t.step(
          "shortcode is invalidated when the window is removed",
          async () => {
            const { result: w } = await callTool<{
              policy_id: string;
              shortcode: string;
            }>(listenerToken, "open_receptive_window", {
              duration_seconds: 120,
            });
            assertExists(w);
            await callTool(listenerToken, "remove_receptive_policy", {
              policy_id: w.policy_id,
            });
            const { result, body } = await callTool(
              senderToken,
              "send_invitation",
              {
                receiver_domain: serverHost,
                shortcode: w.shortcode,
                communication_terms: TERMS,
              },
            );
            const errorish =
              (result as { ok?: boolean } | undefined)?.ok === false ||
              body.error !== undefined || result === undefined;
            assertEquals(errorish, true);
          },
        );

        await t.step("expired shortcode is rejected", async () => {
          const { result: w } = await callTool<{ shortcode: string }>(
            listenerToken,
            "open_receptive_window",
            { duration_seconds: 1 },
          );
          assertExists(w);
          await new Promise((r) => setTimeout(r, 1500));
          const { result, body } = await callTool(
            senderToken,
            "send_invitation",
            {
              receiver_domain: serverHost,
              shortcode: w.shortcode,
              communication_terms: TERMS,
            },
          );
          const errorish =
            (result as { ok?: boolean } | undefined)?.ok === false ||
            body.error !== undefined || result === undefined;
          assertEquals(errorish, true);
        });
      });
    });
  },
});
