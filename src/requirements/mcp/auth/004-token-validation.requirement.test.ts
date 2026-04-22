import { assertEquals } from "@std/assert";
import { withStartedServer } from "../../test-helpers.ts";
import {
  assertAuthFailure,
  requiredScopes,
  testAudience,
  withAuthTestContext,
} from "./test-helpers.ts";

Deno.test({
  name:
    "req:mcp-auth-004 - Access token validation enforces audience and token validity",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ baseUrl }) => {
        await t.step("server starts and becomes healthy", async () => {
          const res = await fetch(`${baseUrl}/health`);
          assertEquals(res.status, 200);
          const body = await res.json();
          assertEquals(body.ok, true);
        });

        await t.step("rejects tokens with invalid issuer", async () => {
          const token = await issueToken({
            iss: "https://another-issuer.example.test/",
            scope: requiredScopes[0],
          });

          await assertAuthFailure(token, 401, "E_INVALID_ISSUER", baseUrl);
        });

        await t.step("rejects tokens with invalid audience", async () => {
          const token = await issueToken({
            aud: "api://wrong-audience",
            scope: requiredScopes[0],
          });

          await assertAuthFailure(token, 401, "E_INVALID_AUDIENCE", baseUrl);
        });

        await t.step("rejects expired tokens", async () => {
          const token = await issueToken({
            exp: Math.floor(Date.now() / 1000) - 60,
            scope: requiredScopes[0],
          });

          await assertAuthFailure(token, 401, "E_EXPIRED", baseUrl);
        });

        await t.step("rejects tokens with invalid signatures", async () => {
          const token = await issueToken({ scope: requiredScopes[0] });
          const tampered = tamperPayloadWithoutResigning(token);

          await assertAuthFailure(tampered, 401, "E_INVALID_SIGNATURE", baseUrl);
        });

        await t.step(
          "rejects valid tokens with insufficient scope",
          async () => {
            const token = await issueToken({
              scope: `${testAudience}/custom.scope`,
            });

            await assertAuthFailure(token, 403, "E_INSUFFICIENT_SCOPE", baseUrl);
          },
        );

        await t.step(
          "accepts Azure-style scp claim with required scope",
          async () => {
            const token = await issueToken({
              scp: requiredScopes[0],
            });

            const response = await fetch(`${baseUrl}/mcp`, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "accept": "application/json, text/event-stream",
                authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                jsonrpc: "2.0",
                id: "req-1",
                method: "tools/call",
                params: {
                  name: "get_permissions",
                  arguments: {},
                },
              }),
            });

            assertEquals(response.status, 200);
            await response.text();
          },
        );
      });
    });
  },
});

function tamperPayloadWithoutResigning(token: string): string {
  const [header, payload, signature] = token.split(".");
  const decodedPayload = JSON.parse(decodeBase64Url(payload)) as Record<
    string,
    unknown
  >;
  decodedPayload.sub = "tampered-subject";
  const tamperedPayload = encodeBase64Url(
    new TextEncoder().encode(JSON.stringify(decodedPayload)),
  );
  return `${header}.${tamperedPayload}.${signature}`;
}

function decodeBase64Url(value: string): string {
  return new TextDecoder().decode(
    Uint8Array.fromBase64(value, { alphabet: "base64url" }),
  );
}

function encodeBase64Url(bytes: Uint8Array): string {
  return bytes.toBase64({ alphabet: "base64url", omitPadding: true });
}
