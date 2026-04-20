---
id: mcp-001
title: Tools use structured output with outputSchema
---

# Tool Output Format

All MCP tools that return structured data MUST declare an `outputSchema` and
return results via `structuredContent` alongside a `text` content fallback.

## Rationale

The MCP specification (2025-11-25) supports `outputSchema` on tool definitions
and `structuredContent` in tool results. Using these features provides:

- Schema-validated outputs that clients can rely on programmatically.
- A JSON text fallback in `content` for backwards compatibility with older
  clients and for LLM consumption.
- Clear contracts between server and client on the shape of tool results.

## Expected behavior

- Tools MUST declare an `outputSchema` using a zod schema that describes the
  structure of the result.
- Tool handlers MUST return a `structuredContent` object conforming to the
  declared `outputSchema`.
- Tool handlers MUST also return a `content` array containing a `type: "text"`
  item with the JSON-serialized `structuredContent` for backwards compatibility.
- Tools MUST be registered via `registerTool` (not the deprecated `.tool()`
  method).
- Clients can `JSON.parse` the text fallback or use `structuredContent` directly
  to recover the structured result.
- Tools MUST NOT return raw unstructured text when the result is structured
  data.
- Tool handlers SHOULD use the shared `toolResult()` helper from
  `src/tools/tool-result.ts` to produce both `structuredContent` and the text
  fallback from a single data object.

## Future considerations

Alternative token-efficient encodings (e.g., TOON) MAY be adopted for list-heavy
responses if benchmarks demonstrate material savings and client support is
established. Any such change would require updating this requirement.
