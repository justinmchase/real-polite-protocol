import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";

Deno.test({
  name:
    "req:domain-admin-010 - Domain administrators can remove admin verified metadata",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ kvPath, callTool, baseUrl }) => {
        await t.step(
          "domain admin can remove one admin verified metadata field",
          async () => {
            const kv = await Deno.openKv(kvPath);
            try {
              await kv.set(["accounts", "by_oid", "oid-target-user"], {
                id: "account-target-user",
                oid: "oid-target-user",
                domain_id: "00000000-0000-7000-8000-000000000001",
                created_at: "2026-04-20T00:00:00.000Z",
                updated_at: "2026-04-20T00:00:00.000Z",
              });
              await kv.set(
                ["accounts", "verified_metadata", "oid-target-user"],
                {
                  oid: "oid-target-user",
                  user_verified_fields: {
                    display_name: "Alice Token",
                    email: "alice@example.test",
                  },
                  admin_verified_fields: {
                    display_name: "Dr. Alice Smith",
                    title: "Professor",
                    office: "CS-402",
                  },
                  user_updated_at: "2026-04-20T00:00:00.000Z",
                  admin_updated_at: "2026-04-20T01:00:00.000Z",
                  updated_at: "2026-04-20T01:00:00.000Z",
                },
              );
            } finally {
              kv.close();
            }

            const token = await issueToken({
              oid: "oid-domain-admin",
              roles: ["domain.admin"],
              scope: requiredScopes.join(" "),
            });

            const { status, body } = await callTool(
              token,
              "remove_admin_verified_metadata",
              {
                oid: "oid-target-user",
                field: "display_name",
              },
            );
            assertEquals(status, 200);
            assertExists(body.result);

            const text = (body.result as { content?: Array<{ text?: string }> })
              .content?.[0]?.text;
            assertExists(text);
            const payload = JSON.parse(text) as {
              user_verified_fields?: Record<string, string>;
              admin_verified_fields?: Record<string, string>;
              verified_fields?: Record<string, string>;
            };

            assertEquals(
              payload.user_verified_fields?.display_name,
              "Alice Token",
            );
            assertEquals(
              payload.admin_verified_fields?.display_name,
              undefined,
            );
            assertEquals(payload.admin_verified_fields?.title, "Professor");
            assertEquals(payload.verified_fields?.display_name, "Alice Token");
            assertEquals(payload.verified_fields?.title, "Professor");

            const getResult = await callTool(
              token,
              "get_user_verified_metadata",
              { oid: "oid-target-user" },
            );
            assertEquals(getResult.status, 200);
            const getText = (getResult.body.result as {
              content?: Array<{ text?: string }>;
            }).content?.[0]?.text;
            assertExists(getText);
            const getPayload = JSON.parse(getText) as {
              admin_verified_fields?: Record<string, string>;
              verified_fields?: Record<string, string>;
            };
            assertEquals(
              getPayload.admin_verified_fields?.display_name,
              undefined,
            );
            assertEquals(
              getPayload.verified_fields?.display_name,
              "Alice Token",
            );
          },
        );

        await t.step(
          "missing admin field returns a stable error contract",
          async () => {
            const token = await issueToken({
              oid: "oid-domain-admin",
              roles: ["domain.admin"],
              scope: requiredScopes.join(" "),
            });

            const { status, body } = await callTool(
              token,
              "remove_admin_verified_metadata",
              {
                oid: "oid-target-user",
                field: "unknown_field",
              },
            );
            assertEquals(status, 200);
            assertExists(body.result);

            const result = body.result as {
              isError?: boolean;
              content?: Array<{ text?: string }>;
            };
            assertEquals(result.isError, true);

            const text = result.content?.[0]?.text;
            assertExists(text);
            const payload = JSON.parse(text) as {
              ok?: boolean;
              error?: { code?: string; message?: string };
            };

            assertEquals(payload.ok, false);
            assertEquals(
              payload.error?.code,
              "E_ADMIN_VERIFIED_METADATA_FIELD_NOT_FOUND",
            );
            assertEquals(
              payload.error?.message,
              "No admin verified metadata field unknown_field found for oid oid-target-user",
            );
          },
        );

        await t.step(
          "non-admin user cannot call remove_admin_verified_metadata",
          async () => {
            const token = await issueToken({
              oid: "oid-listener",
              roles: [],
              scope: requiredScopes.join(" "),
            });

            const { status, body } = await callTool(
              token,
              "remove_admin_verified_metadata",
              {
                oid: "oid-target-user",
                field: "display_name",
              },
            );
            assertEquals(status, 200);

            const error = body.error as
              | { code?: number; message?: string }
              | undefined;
            const result = body.result as { isError?: boolean } | undefined;

            const isToolUnavailable = error !== undefined ||
              result?.isError === true;
            assertEquals(
              isToolUnavailable,
              true,
              `Tool should not be available to non-admin. Body: ${
                JSON.stringify(body)
              }`,
            );
          },
        );

        await t.step(
          "subsequent invitation does not carry the removed admin-verified field",
          async () => {
            // After step 1 removed display_name from oid-target-user's admin_verified_fields,
            // a new invitation sent by oid-target-user requesting that field should NOT
            // include it in claims.admin.
            const userToken = await issueToken({
              oid: "oid-target-user",
              scope: requiredScopes.join(" "),
            });

            // Open a receptive window so there is a valid policy to deliver to.
            const { result: windowResult } = await callTool<{
              policy_id: string;
            }>(userToken, "open_receptive_window", { duration_seconds: 300 });
            assertExists(windowResult?.policy_id);

            const receiverDomain = new URL(baseUrl).host;

            // Send an invitation requesting the (now-removed) display_name admin claim.
            const { result: invResult } = await callTool<{
              invitation_id?: string;
            }>(userToken, "send_invitation", {
              receiver_domain: receiverDomain,
              receptive_policy_id: windowResult.policy_id,
              proposed_terms: { category: "correspondence" },
              include_admin_claims: ["display_name"],
            });
            assertExists(invResult?.invitation_id);

            // Read the stored invitation from KV and verify claims.admin is absent
            // or does not include display_name.
            const kv = await Deno.openKv(kvPath);
            try {
              const entry = await kv.get<Record<string, unknown>>(
                ["invitations", invResult.invitation_id],
              );
              assertExists(entry.value, "invitation must be stored in KV");
              const claims = entry.value.claims as
                | { admin?: Record<string, unknown> }
                | undefined;

              assertEquals(
                claims?.admin?.display_name,
                undefined,
                "removed admin field must not appear in subsequent invitation claims",
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
