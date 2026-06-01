// Loads or generates the local RSA keypair used to sign dev-issuer tokens.
//
// Keys live under .dev/keys/ (gitignored). The matching public JWK is what the
// running RPP server reads when RPP_DEV_MODE=1.

import { dirname } from "@std/path";

const PRIV_PATH = ".dev/keys/dev.priv.jwk.json";
const PUB_PATH = ".dev/keys/dev.pub.jwk.json";
const KID = "dev-1";

export interface DevKeyPair {
  privateJwk: JsonWebKey;
  publicJwk: JsonWebKey;
  privateKey: CryptoKey;
  kid: string;
}

export async function ensureDevKeyPair(): Promise<DevKeyPair> {
  try {
    const [privText, pubText] = await Promise.all([
      Deno.readTextFile(PRIV_PATH),
      Deno.readTextFile(PUB_PATH),
    ]);
    const privateJwk = JSON.parse(privText) as JsonWebKey;
    const publicJwk = JSON.parse(pubText) as JsonWebKey;
    const privateKey = await crypto.subtle.importKey(
      "jwk",
      privateJwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );
    return { privateJwk, publicJwk, privateKey, kid: KID };
  } catch {
    return await generateAndWrite();
  }
}

async function generateAndWrite(): Promise<DevKeyPair> {
  console.error("[dev] Generating RPP dev keypair…");
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  ) as CryptoKeyPair;

  const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey) as
    & JsonWebKey
    & Record<string, unknown>;
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey) as
    & JsonWebKey
    & Record<string, unknown>;
  privateJwk.kid = KID;
  publicJwk.kid = KID;
  privateJwk.alg = "RS256";
  publicJwk.alg = "RS256";

  await Deno.mkdir(dirname(PRIV_PATH), { recursive: true });
  await Deno.writeTextFile(PRIV_PATH, JSON.stringify(privateJwk, null, 2));
  await Deno.writeTextFile(PUB_PATH, JSON.stringify(publicJwk, null, 2));
  try {
    await Deno.chmod(PRIV_PATH, 0o600);
  } catch {
    // chmod not supported (e.g. Windows); safe to ignore.
  }

  return { privateJwk, publicJwk, privateKey: pair.privateKey, kid: KID };
}
