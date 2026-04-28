import { assertEquals, assertExists, assertMatch } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";

Deno.test({
  name:
    "req:receptive-policy-007 - Receptive windows expose a shareable shortcode",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ port, callTool }) => {
        const serverHost = `localhost:${port}`;

        // ── shared listener account ──────────────────────────────────────────
        const listenerOid = crypto.randomUUID();
        const listenerToken = await issueToken({
          oid: listenerOid,
          scope: requiredScopes.join(" "),
          name: "Listener",
        });
        await callTool(listenerToken, "set_user_verified_metadata");

        // ── shared sender account ────────────────────────────────────────────
        const senderOid = crypto.randomUUID();
        const senderToken = await issueToken({
          oid: senderOid,
          scope: requiredScopes.join(" "),
          name: "Sender",
        });
        await callTool(senderToken, "set_user_verified_metadata");

        // Open a window once; reuse across steps that only read it.
        const { result: windowResult } = await callTool<{
          policy_id: string;
          shortcode?: string;
          domain?: string;
          receptive_until?: string;
          mode: string;
        }>(listenerToken, "open_receptive_window", { duration_seconds: 120 });
        assertExists(windowResult);

        await t.step(
          "open_receptive_window response includes a shortcode field",
          () => {
            assertExists(
              windowResult.shortcode,
              "shortcode must be present in the open_receptive_window response",
            );
          },
        );

        await t.step(
          "open_receptive_window response includes a domain field",
          () => {
            assertExists(
              windowResult.domain,
              "domain must be present in the open_receptive_window response",
            );
            assertEquals(
              typeof windowResult.domain,
              "string",
              "domain must be a string",
            );
            assertEquals(
              (windowResult.domain ?? "").length > 0,
              true,
              "domain must be non-empty",
            );
          },
        );

        await t.step(
          "shortcode is exactly 8 lowercase alphanumeric characters",
          () => {
            assertMatch(
              windowResult.shortcode!,
              /^[a-z0-9]{8}$/,
              "shortcode must match [a-z0-9]{8}",
            );
          },
        );

        await t.step(
          "two consecutive windows have different shortcodes",
          async () => {
            const { result: second } = await callTool<{
              shortcode?: string;
            }>(listenerToken, "open_receptive_window", {
              duration_seconds: 120,
            });
            assertExists(second);
            assertExists(second.shortcode);
            assertEquals(
              second.shortcode !== windowResult.shortcode,
              true,
              "consecutive windows must have distinct shortcodes",
            );
          },
        );

        await t.step(
          "five concurrent windows each receive a unique shortcode (uniqueness/retry invariant)",
          async () => {
            const shortcodes: string[] = [];
            for (let i = 0; i < 5; i++) {
              const { result: w } = await callTool<{ shortcode?: string }>(
                listenerToken,
                "open_receptive_window",
                { duration_seconds: 120 },
              );
              assertExists(w);
              assertExists(w.shortcode);
              shortcodes.push(w.shortcode!);
            }
            const unique = new Set(shortcodes);
            assertEquals(
              unique.size,
              shortcodes.length,
              `All shortcodes must be unique; got: ${shortcodes.join(", ")}`,
            );
          },
        );

        await t.step(
          "send_invitation with shortcode + receiver_domain delivers successfully",
          async () => {
            const { result } = await callTool<{ invitation_id?: string }>(
              senderToken,
              "send_invitation",
              {
                receiver_domain: serverHost,
                shortcode: windowResult.shortcode,
                proposed_terms: { category: "billing" },
              },
            );
            assertExists(result);
            assertExists(
              (result as { invitation_id?: string }).invitation_id,
              "send_invitation with shortcode must return an invitation_id",
            );
          },
        );

        await t.step(
          "send_invitation with an unknown shortcode returns E_RECEPTIVE_POLICY_NOT_FOUND",
          async () => {
            const { result } = await callTool<{ ok?: boolean; error?: string }>(
              senderToken,
              "send_invitation",
              {
                receiver_domain: serverHost,
                shortcode: "00000000", // intentionally invalid
                proposed_terms: { category: "billing" },
              },
            );
            assertExists(result);
            assertEquals(
              (result as { ok?: boolean }).ok,
              false,
              "unknown shortcode must yield a structured error",
            );
          },
        );

        await t.step(
          "shortcode is removed when the policy is deleted",
          async () => {
            // Open a new window specifically for this step.
            const { result: w } = await callTool<{
              policy_id: string;
              shortcode?: string;
            }>(listenerToken, "open_receptive_window", {
              duration_seconds: 120,
            });
            assertExists(w);
            assertExists(w.shortcode);

            // Remove the policy.
            await callTool(listenerToken, "remove_receptive_policy", {
              policy_id: w.policy_id,
            });

            // Shortcode should no longer resolve.
            const { result } = await callTool<{ ok?: boolean }>(
              senderToken,
              "send_invitation",
              {
                receiver_domain: serverHost,
                shortcode: w.shortcode,
                proposed_terms: { category: "billing" },
              },
            );
            assertExists(result);
            assertEquals(
              (result as { ok?: boolean }).ok,
              false,
              "shortcode must be invalid after its policy is removed",
            );
          },
        );

        await t.step(
          "shortcode for an expired window resolves but yields E_RECEPTIVE_POLICY_EXPIRED",
          async () => {
            // Open a 1-second window.
            const { result: w } = await callTool<{
              policy_id: string;
              shortcode?: string;
            }>(listenerToken, "open_receptive_window", {
              duration_seconds: 1,
            });
            assertExists(w);
            assertExists(w.shortcode);

            // Wait for the window to expire.
            await new Promise((resolve) => setTimeout(resolve, 1500));

            // Attempt to deliver via the expired shortcode.
            const { result } = await callTool<{ ok?: boolean }>(
              senderToken,
              "send_invitation",
              {
                receiver_domain: serverHost,
                shortcode: w.shortcode,
                proposed_terms: { category: "billing" },
              },
            );
            assertExists(result);
            assertEquals(
              (result as { ok?: boolean }).ok,
              false,
              "expired shortcode must yield a structured error",
            );
          },
        );
      });
    });
  },
});
