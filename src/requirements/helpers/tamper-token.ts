/**
 * Tampers the payload section of a JWT without re-signing, producing a token
 * with an invalid signature. Used to test signature validation.
 */
export function tamperPayloadWithoutResigning(token: string): string {
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
