import { encodeHex } from "@std/encoding/hex";
import { generate as generateUUIDv7 } from "@std/uuid/v7";
import type { ContactCredential } from "../../models/invitation/invitation.model.ts";

/**
 * Generate a fresh contact credential. The `contact_id` is a UUIDv7 (opaque
 * to the other side) and `contact_secret` is 32 hex chars (128 bits) of
 * cryptographic randomness as required by spec §10.1.
 */
export function generateContactCredential(): ContactCredential {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return {
    contact_id: generateUUIDv7(),
    contact_secret: encodeHex(bytes),
  };
}
