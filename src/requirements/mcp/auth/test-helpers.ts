import { assertEquals, assertExists } from "@std/assert";
import { stub } from "@std/testing/mock";

export const testIssuer = "https://issuer.example.test/";
export const testAudience = "api://test-api-app";
export const testBareAudience = "test-api-app";
export const testApiAppClientId = "test-api-app";
export const requiredScopes = [
  `${testAudience}/rpp.tools.read`,
  `${testAudience}/rpp.messages.submit`,
];

export interface IssueTokenOverrides {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  nbf?: number;
  scope?: string;
  scp?: string;
  sub?: string;
  oid?: string;
  roles?: string[] | string;
  name?: string;
  email?: string;
  preferred_username?: string;
  header?: Record<string, unknown>;
}

export interface AuthTestContext {
  issueToken: (overrides?: IssueTokenOverrides) => Promise<string>;
}

export interface AuthTestOptions {
  onJwksRequest?: (request: Request) => void | Promise<void>;
}

let authTestLock: Promise<void> = Promise.resolve();

export async function withAuthTestContext(
  run: (context: AuthTestContext) => Promise<void>,
  options: AuthTestOptions = {},
): Promise<void> {
  const previousLock = authTestLock;
  let releaseLock: (() => void) | undefined;
  authTestLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  await previousLock;

  const algorithm = {
    name: "RSASSA-PKCS1-v1_5",
    hash: "SHA-256",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
  } as const;
  const keyPair = await crypto.subtle.generateKey(algorithm, true, [
    "sign",
    "verify",
  ]);
  const exportedPublicJwk = await crypto.subtle.exportKey(
    "jwk",
    keyPair.publicKey,
  ) as JsonWebKey;
  const publicJwk = {
    ...exportedPublicJwk,
    kid: "test-key",
    use: "sig",
    alg: "RS256",
  };

  const originalFetch = globalThis.fetch;
  const jwksUrl = new URL(".well-known/jwks.json", testIssuer).toString();
  const fetchStub = stub(
    globalThis,
    "fetch",
    async (...args: Parameters<typeof globalThis.fetch>) => {
      const [input, init] = args;
      const request = input instanceof Request
        ? input
        : new Request(input, init as RequestInit);

      if (request.url === jwksUrl) {
        await options.onJwksRequest?.(request);
        return Response.json({ keys: [publicJwk] });
      }

      return await originalFetch(...args);
    },
  );

  const envKeys = [
    "AUTH_ISSUER",
    "AUTH_AUDIENCE",
    "AZURE_API_APP_CLIENT_ID",
  ] as const;
  const previousEnv = new Map<string, string | undefined>();

  try {
    for (const key of envKeys) {
      previousEnv.set(key, Deno.env.get(key));
    }

    Deno.env.set("AUTH_ISSUER", testIssuer);
    Deno.env.set("AUTH_AUDIENCE", testAudience);
    Deno.env.set("AZURE_API_APP_CLIENT_ID", testApiAppClientId);

    await run({
      issueToken: async (overrides = {}) => {
        const now = Math.floor(Date.now() / 1000);
        const header = {
          alg: "RS256",
          typ: "JWT",
          kid: "test-key",
          ...overrides.header,
        };
        const payload = {
          iss: overrides.iss ?? testIssuer,
          sub: overrides.sub ?? "test-subject",
          oid: overrides.oid ?? "test-oid",
          aud: overrides.aud ?? testAudience,
          exp: overrides.exp ?? now + 3600,
          iat: overrides.iat ?? now,
          ...(overrides.nbf ? { nbf: overrides.nbf } : {}),
          ...(overrides.scope ? { scope: overrides.scope } : {}),
          ...(overrides.scp ? { scp: overrides.scp } : {}),
          ...(overrides.roles ? { roles: overrides.roles } : {}),
          ...(overrides.name ? { name: overrides.name } : {}),
          ...(overrides.email ? { email: overrides.email } : {}),
          ...(overrides.preferred_username
            ? { preferred_username: overrides.preferred_username }
            : {}),
        };

        const encodedHeader = encodeBase64UrlJson(header);
        const encodedPayload = encodeBase64UrlJson(payload);
        const data = new TextEncoder().encode(
          `${encodedHeader}.${encodedPayload}`,
        );
        const signature = await crypto.subtle.sign(
          "RSASSA-PKCS1-v1_5",
          keyPair.privateKey,
          data,
        );

        return `${encodedHeader}.${encodedPayload}.${
          encodeBase64UrlBytes(new Uint8Array(signature))
        }`;
      },
    });
  } finally {
    fetchStub.restore();
    for (const key of envKeys) {
      const previous = previousEnv.get(key);
      if (previous === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, previous);
      }
    }
    releaseLock?.();
  }
}

export async function assertAuthFailure(
  token: string,
  expectedStatus: number,
  expectedCode: string,
): Promise<void> {
  const response = await fetch("http://localhost:8000/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });

  assertEquals(response.status, expectedStatus);
  assertExists(response.headers.get("WWW-Authenticate"));

  const body = await response.json();
  assertEquals(body.ok, false);
  assertEquals(body.code, expectedCode);
}

function encodeBase64UrlJson(value: unknown): string {
  return encodeBase64UrlBytes(
    new TextEncoder().encode(JSON.stringify(value)),
  );
}

function encodeBase64UrlBytes(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
