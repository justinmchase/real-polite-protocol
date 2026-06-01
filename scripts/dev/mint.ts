// Mints a dev-issuer JWT for a persona. Signed with the local RS256 dev key.
// The server accepts these only when RPP_DEV_MODE=1.

import { ensureDevKeyPair } from "./keys.ts";
import type { Persona } from "./personas.ts";

const DEFAULT_ISSUER = "urn:rpp:dev";
const DEFAULT_TTL_SECONDS = 60 * 60; // 1 hour

export interface MintOptions {
  persona: Persona;
  audience: string;
  apiAppClientId: string;
  issuer?: string;
  ttlSeconds?: number;
}

export async function mintToken(opts: MintOptions): Promise<string> {
  const { persona } = opts;
  const issuer = opts.issuer ?? DEFAULT_ISSUER;
  const ttl = opts.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const now = Math.floor(Date.now() / 1000);
  const { privateKey, kid } = await ensureDevKeyPair();

  const header = { alg: "RS256", typ: "JWT", kid };
  const payload = {
    iss: issuer,
    sub: persona.oid,
    oid: persona.oid,
    aud: opts.audience,
    iat: now,
    nbf: now,
    exp: now + ttl,
    scope:
      `api://${opts.apiAppClientId}/rpp.tools.read api://${opts.apiAppClientId}/rpp.messages.submit`,
    roles: persona.roles,
    name: persona.display_name,
    email: persona.email,
    preferred_username: persona.preferred_username,
  };

  const signingInput = `${b64url(JSON.stringify(header))}.${
    b64url(JSON.stringify(payload))
  }`;
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      privateKey,
      new TextEncoder().encode(signingInput),
    ),
  );
  return `${signingInput}.${b64urlBytes(sig)}`;
}

function b64url(text: string): string {
  return b64urlBytes(new TextEncoder().encode(text));
}

function b64urlBytes(bytes: Uint8Array): string {
  return bytes.toBase64({ alphabet: "base64url", omitPadding: true });
}
