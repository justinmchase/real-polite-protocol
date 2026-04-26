import { z } from "zod";

/**
 * Schema for a `Date` field on an MCP tool's INPUT.
 *
 * - Wire shape: ISO 8601 datetime string (representable in JSON Schema).
 * - Parsed value: `Date`.
 *
 * Use this in tool `inputSchema` definitions instead of `z.coerce.date()`,
 * which is not representable in JSON Schema and breaks MCP `tools/list`.
 */
export function inputDate() {
  return z.iso.datetime().transform((s) => new Date(s));
}

/**
 * Schema for a `Date` field on an MCP tool's OUTPUT.
 *
 * - Wire shape: ISO 8601 datetime string (representable in JSON Schema).
 *
 * Tool handlers should still pass `Date` instances into `toolResult`; the
 * boundary JSON-serializes them to ISO strings before MCP validates them
 * against this schema.
 */
export function outputDate() {
  return z.iso.datetime();
}
