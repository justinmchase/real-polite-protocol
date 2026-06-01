import { encodeHex } from "@std/encoding/hex";

const TEXT_ENCODER = new TextEncoder();

/**
 * Verify an HMAC-SHA-256 signature over the canonical RPP input
 * `<timestamp>.<request-body-bytes>` (spec §6.1) using the supplied secret.
 * Returns true on a constant-time match.
 */
export async function verifyEnvelopeHmac(
  secret: string,
  timestamp: string,
  bodyBytes: Uint8Array,
  presentedSignature: string,
): Promise<boolean> {
  const keyBytes = TEXT_ENCODER.encode(secret);
  const prefix = TEXT_ENCODER.encode(`${timestamp}.`);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const combined = new Uint8Array(prefix.length + bodyBytes.length);
  combined.set(prefix, 0);
  combined.set(bodyBytes, prefix.length);

  const computed = await crypto.subtle.sign("HMAC", cryptoKey, combined);
  const computedHex = encodeHex(new Uint8Array(computed));
  return constantTimeEquals(computedHex, presentedSignature.toLowerCase());
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
