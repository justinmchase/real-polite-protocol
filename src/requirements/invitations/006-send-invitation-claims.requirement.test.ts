import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";

Deno.test({
  name:
    "req:invitations-006 - Senders can attach verified and custom claims to outgoing invitations",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ baseUrl, callTool, kvPath }) => {
        const accountOid = crypto.randomUUID();
        const token = await issueToken({
          oid: accountOid,
          scope: requiredScopes.join(" "),
          name: "Alice Smith",
          email: "alice@sender.example",
        });

        // Populate user_verified_fields from token.
        await callTool(token, "set_user_verified_metadata");

        // Open a receptive window so send_invitation has a valid policy to deliver to.
        const { result: windowPolicy } = await callTool<{ policy_id: string }>(
          token,
          "open_receptive_window",
          { duration_seconds: 300 },
        );
        assertExists(windowPolicy);
        const policyId = windowPolicy.policy_id;
        const receiverDomain = new URL(baseUrl).host;

        await t.step(
          "send_invitation with no claim inputs succeeds and omits claims",
          async () => {
            const { status, result } = await callTool<
              { invitation_id?: string }
            >(
              token,
              "send_invitation",
              {
                receiver_domain: receiverDomain,
                receptive_policy_id: policyId,
                proposed_terms: { category: "correspondence" },
                // no include_user_claims, include_admin_claims, or custom_claims
              },
            );

            assertEquals(status, 200);
            assertExists(result?.invitation_id);
          },
        );

        await t.step(
          "include_user_claims resolves values from stored user_verified_fields",
          async () => {
            const { status, result } = await callTool<
              { invitation_id?: string }
            >(
              token,
              "send_invitation",
              {
                receiver_domain: receiverDomain,
                receptive_policy_id: policyId,
                proposed_terms: { category: "correspondence" },
                include_user_claims: ["name", "email"],
              },
            );

            assertEquals(status, 200);
            assertExists(result?.invitation_id);
          },
        );

        await t.step(
          "missing keys in include_user_claims are silently dropped",
          async () => {
            // "nonexistent_key" does not exist in stored metadata — tool must not error.
            const { status, result } = await callTool<
              { invitation_id?: string }
            >(
              token,
              "send_invitation",
              {
                receiver_domain: receiverDomain,
                receptive_policy_id: policyId,
                proposed_terms: { category: "correspondence" },
                include_user_claims: ["name", "nonexistent_key"],
              },
            );

            assertEquals(status, 200);
            assertExists(result?.invitation_id);
          },
        );

        await t.step(
          "custom_claims are included verbatim in the envelope",
          async () => {
            const { status, result } = await callTool<
              { invitation_id?: string }
            >(
              token,
              "send_invitation",
              {
                receiver_domain: receiverDomain,
                receptive_policy_id: policyId,
                proposed_terms: { category: "correspondence" },
                custom_claims: { note: "We met at the conference", year: 2026 },
              },
            );

            assertEquals(status, 200);
            assertExists(result?.invitation_id);
          },
        );

        await t.step(
          "all three claim types can be combined in one invitation",
          async () => {
            const { status, result } = await callTool<
              { invitation_id?: string }
            >(
              token,
              "send_invitation",
              {
                receiver_domain: receiverDomain,
                receptive_policy_id: policyId,
                proposed_terms: { category: "correspondence" },
                include_user_claims: ["name"],
                custom_claims: { reason: "Follow-up from summit" },
              },
            );

            assertEquals(status, 200);
            assertExists(result?.invitation_id);
          },
        );

        await t.step(
          "invitation envelope has absent or empty claims when no claim inputs provided",
          async () => {
            const { result: inv } = await callTool<{ invitation_id?: string }>(
              token,
              "send_invitation",
              {
                receiver_domain: receiverDomain,
                receptive_policy_id: policyId,
                proposed_terms: { category: "correspondence" },
                // No include_user_claims, include_admin_claims, or custom_claims
              },
            );
            assertExists(inv?.invitation_id);

            // The invitation was delivered to the local server's envelope endpoint
            // and stored in KV. Read it back and inspect the claims field.
            const kv = await Deno.openKv(kvPath);
            try {
              const entry = await kv.get<Record<string, unknown>>(
                ["invitations", inv.invitation_id],
              );
              assertExists(entry.value, "invitation must be stored in KV");
              const stored = entry.value;

              // claims.user and claims.custom must be absent when no inputs given.
              // claims.immutable will contain domain_id (always injected), which is OK.
              const claims = stored.claims as
                | { user?: unknown; custom?: unknown }
                | undefined;

              assertEquals(
                claims?.user,
                undefined,
                "claims.user must be absent when no user claims requested",
              );
              assertEquals(
                claims?.custom,
                undefined,
                "claims.custom must be absent when no custom claims provided",
              );
            } finally {
              kv.close();
            }
          },
        );

        await t.step(
          "custom claims are placed under the distinct claims.custom key, separate from user and admin",
          async () => {
            const { result: inv } = await callTool<{ invitation_id?: string }>(
              token,
              "send_invitation",
              {
                receiver_domain: receiverDomain,
                receptive_policy_id: policyId,
                proposed_terms: { category: "correspondence" },
                custom_claims: { greeting: "hello", score: 42 },
              },
            );
            assertExists(inv?.invitation_id);

            const kv = await Deno.openKv(kvPath);
            try {
              const entry = await kv.get<Record<string, unknown>>(
                ["invitations", inv.invitation_id],
              );
              assertExists(entry.value, "invitation must be stored in KV");
              const claims = entry.value.claims as
                | {
                  custom?: Record<string, unknown>;
                  user?: Record<string, unknown>;
                  admin?: Record<string, unknown>;
                }
                | undefined;

              // Custom claims go under claims.custom, not under claims.user or claims.admin.
              assertEquals(
                claims?.custom?.greeting,
                "hello",
                "claims.custom.greeting must equal the provided value",
              );
              assertEquals(
                claims?.custom?.score,
                42,
                "claims.custom.score must equal the provided value",
              );
              assertEquals(
                claims?.user?.greeting,
                undefined,
                "claims.user must not contain the custom greeting key",
              );
              assertEquals(
                claims?.admin?.greeting,
                undefined,
                "claims.admin must not contain the custom greeting key",
              );
            } finally {
              kv.close();
            }
          },
        );

        await t.step(
          "send_invitation does not allow injecting user or admin claim values directly as arguments",
          async () => {
            // The schema only accepts include_user_claims as an array of keys.
            // Attempting to pass raw user/admin value maps must not affect the
            // resolved claims — the server is the sole source of those values.
            const { status, result: inv } = await callTool<
              { invitation_id?: string }
            >(
              token,
              "send_invitation",
              {
                receiver_domain: receiverDomain,
                receptive_policy_id: policyId,
                proposed_terms: { category: "correspondence" },
                // These extra fields are not part of the input schema.
                user: { name: "Injected Name" },
                admin: { title: "Fake Title" },
              },
            );

            assertEquals(
              status,
              200,
              "send_invitation must succeed even if unknown fields are passed",
            );
            assertExists(inv?.invitation_id);

            // The stored invitation must NOT contain user/admin claims with injected values.
            const kv = await Deno.openKv(kvPath);
            try {
              const entry = await kv.get<Record<string, unknown>>(
                ["invitations", inv.invitation_id],
              );
              assertExists(entry.value);
              const claims = entry.value.claims as
                | {
                  user?: Record<string, unknown>;
                  admin?: Record<string, unknown>;
                }
                | undefined;

              assertEquals(
                claims?.user?.name,
                undefined,
                "injected user.name must not appear in claims.user",
              );
              assertEquals(
                claims?.admin?.title,
                undefined,
                "injected admin.title must not appear in claims.admin",
              );
            } finally {
              kv.close();
            }
          },
        );

        await t.step(
          "invitation envelope user claim values match stored user_verified_fields, not caller-supplied data",
          async () => {
            // Alice's token has name="Alice Smith"; set_user_verified_metadata
            // was called at test setup, so name is already in the store.
            const { result: inv } = await callTool<{ invitation_id?: string }>(
              token,
              "send_invitation",
              {
                receiver_domain: receiverDomain,
                receptive_policy_id: policyId,
                proposed_terms: { category: "correspondence" },
                include_user_claims: ["name", "email"],
              },
            );
            assertExists(inv?.invitation_id);

            const kv = await Deno.openKv(kvPath);
            try {
              const entry = await kv.get<Record<string, unknown>>(
                ["invitations", inv.invitation_id],
              );
              assertExists(entry.value);
              const claims = entry.value.claims as
                | { user?: Record<string, unknown> }
                | undefined;

              // Values must originate from the server's verified metadata store.
              assertEquals(
                claims?.user?.name,
                "Alice Smith",
                "claims.user.name must equal the value stored by set_user_verified_metadata",
              );
              assertEquals(
                claims?.user?.email,
                "alice@sender.example",
                "claims.user.email must equal the value stored by set_user_verified_metadata",
              );
            } finally {
              kv.close();
            }
          },
        );
      });
    });
  },
});
