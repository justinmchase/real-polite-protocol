import { assertEquals } from "@std/assert";
import { withStartedServer } from "../../test-helpers.ts";
import {
  assertAuthFailure,
  requiredScopes,
  testBareAudience,
  withAuthTestContext,
} from "./test-helpers.ts";

Deno.test({
  name: "req:mcp-auth-012 - Azure AD/Entra ID v2.0 token compatibility",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async () => {
        await t.step("server starts and becomes healthy", async () => {
          const res = await fetch("http://localhost:8000/health");
          assertEquals(res.status, 200);
          const body = await res.json();
          assertEquals(body.ok, true);
        });

        await t.step("accepts v2.0 token with bare client ID audience", async () => {
          const token = await issueToken({
            aud: testBareAudience,
            scp: requiredScopes[0],
          });

          const response = await fetch("http://localhost:8000/mcp", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "accept": "application/json, text/event-stream",
              authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: "req-1",
              method: "tools/list",
            }),
          });

          assertEquals(response.status, 200);
          await response.text();
        });

        await t.step("accepts v2.0 token with scp claim", async () => {
          const token = await issueToken({
            aud: testBareAudience,
            scp: "rpp.tools.read rpp.messages.submit",
          });

          const response = await fetch("http://localhost:8000/mcp", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "accept": "application/json, text/event-stream",
              authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: "req-2",
              method: "tools/list",
            }),
          });

          assertEquals(response.status, 200);
          await response.text();
        });

        await t.step("accepts v2.0 token with roles claim", async () => {
          const token = await issueToken({
            aud: testBareAudience,
            scp: requiredScopes[0],
            roles: ["domain.admin"],
          });

          const response = await fetch("http://localhost:8000/mcp", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "accept": "application/json, text/event-stream",
              authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: "req-3",
              method: "tools/list",
            }),
          });

          assertEquals(response.status, 200);
          await response.text();
        });

        await t.step("rejects v2.0 token with wrong bare audience", async () => {
          const token = await issueToken({
            aud: "wrong-client-id",
            scp: requiredScopes[0],
          });

          await assertAuthFailure(token, 401, "INVALID_AUDIENCE");
        });

        await t.step("rejects v2.0 token with insufficient scp scopes", async () => {
          const token = await issueToken({
            aud: testBareAudience,
            scp: "some.other.scope",
          });

          await assertAuthFailure(token, 403, "INSUFFICIENT_SCOPE");
        });
      });
    });
  },
});
