import { toSerializable } from "@justinmchase/serializable";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function toolResult<T extends object>(
  structuredContent: T,
): CallToolResult {
  const serializableContent = toSerializable(structuredContent);
  return {
    content: [{ type: "text", text: JSON.stringify(serializableContent) }],
    structuredContent: serializableContent,
  };
}

export function toolError(
  code: string,
  message: string,
): CallToolResult {
  const serializableContent = toSerializable({
    ok: false,
    error: {
      code,
      message,
    },
  });
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify(serializableContent) }],
    structuredContent: serializableContent,
  };
}
