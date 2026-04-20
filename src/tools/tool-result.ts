import { toSerializable } from "@justinmchase/serializable";
import { ApplicationError } from "@justinmchase/grove";
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
  error: unknown,
): CallToolResult {
  const normalized = normalizeToolError(error);
  const applicationError = normalized instanceof ApplicationError
    ? normalized
    : new ApplicationError(
      500,
      "E_INTERNAL",
      "Internal server error",
      undefined,
      {
        cause: normalized,
      },
    );
  const serializableContent = toSerializable({
    ok: false,
    error: applicationError,
  });
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify(serializableContent) }],
    structuredContent: serializableContent,
  };
}

export function withToolErrorHandling<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<CallToolResult> | CallToolResult,
): (...args: TArgs) => Promise<CallToolResult> {
  return async (...args: TArgs): Promise<CallToolResult> => {
    try {
      return await handler(...args);
    } catch (error) {
      return toolError(error);
    }
  };
}

function normalizeToolError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  if (typeof error === "string") {
    return new Error(error);
  }
  return new Error("Unknown tool error", { cause: error });
}
