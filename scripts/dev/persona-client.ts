// Programmatic MCP client for a dev persona. Used by both the `test-user` CLI
// (scripts/dev/test-user.ts) and the code-driven scenario tests
// (src/scenarios/**/*.scenario.test.ts).
//
// Each `PersonaClient` mints a dev JWT for the named persona and exposes
// `call(tool, args)` which posts a JSON-RPC `tools/call` to `/mcp` and unwraps
// the first text content block as JSON. Multiple personas can be instantiated
// concurrently to drive multi-user scenarios in a single process.

import { mintToken } from "./mint.ts";
import { loadPersona, type Persona } from "./personas.ts";

export interface PersonaClientOptions {
  server?: string;
  audience?: string;
  apiAppClientId?: string;
}

const DEFAULT_SERVER = Deno.env.get("RPP_SERVER") ?? "http://localhost:8000";
const DEFAULT_API_APP_CLIENT_ID = Deno.env.get("AZURE_API_APP_CLIENT_ID") ??
  "03c7765e-c8c3-462f-a155-d863f44ea1ed";
const DEFAULT_AUDIENCE = Deno.env.get("RPP_AUDIENCE") ??
  `api://${DEFAULT_API_APP_CLIENT_ID}`;

export class PersonaCallError extends Error {
  constructor(
    public readonly persona: string,
    public readonly tool: string,
    public readonly status: number,
    public readonly body: string,
    public readonly mcpError?: unknown,
  ) {
    const detail = mcpError
      ? JSON.stringify(mcpError)
      : `HTTP ${status}: ${body}`;
    super(`[${persona}] ${tool} failed: ${detail}`);
    this.name = "PersonaCallError";
  }
}

export class PersonaClient {
  constructor(
    readonly persona: Persona,
    readonly token: string,
    private readonly server: string,
  ) {}

  /**
   * Call an MCP tool and return the parsed JSON result. Throws
   * `PersonaCallError` on HTTP failure or MCP-level error.
   */
  async call<T = unknown>(
    tool: string,
    args: Record<string, unknown> = {},
  ): Promise<T> {
    const res = await fetch(`${this.server}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "accept": "application/json, text/event-stream",
        "authorization": `Bearer ${this.token}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: tool, arguments: args },
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new PersonaCallError(this.persona.name, tool, res.status, text);
    }
    const json = parseMcpResponse(text);
    if (json && typeof json === "object" && "error" in json) {
      throw new PersonaCallError(
        this.persona.name,
        tool,
        res.status,
        text,
        (json as { error: unknown }).error,
      );
    }
    const result = (json as {
      result?: {
        isError?: boolean;
        content?: Array<{ text?: string }>;
      };
    })?.result;
    const firstText = result?.content?.[0]?.text;
    let parsed: unknown = result;
    if (typeof firstText === "string") {
      try {
        parsed = JSON.parse(firstText);
      } catch {
        parsed = firstText;
      }
    }
    if (result?.isError) {
      throw new PersonaCallError(
        this.persona.name,
        tool,
        res.status,
        text,
        parsed,
      );
    }
    return parsed as T;
  }
}

/**
 * Build a `PersonaClient` for the named dev persona, minting a fresh dev JWT.
 */
export async function personaClient(
  name: string,
  opts: PersonaClientOptions = {},
): Promise<PersonaClient> {
  const persona = await loadPersona(name);
  const apiAppClientId = opts.apiAppClientId ?? DEFAULT_API_APP_CLIENT_ID;
  const audience = opts.audience ?? DEFAULT_AUDIENCE;
  const server = opts.server ?? DEFAULT_SERVER;
  const token = await mintToken({ persona, audience, apiAppClientId });
  return new PersonaClient(persona, token, server);
}

function parseMcpResponse(body: string): unknown {
  const trimmed = body.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return JSON.parse(trimmed);
  }
  for (const line of trimmed.split(/\r?\n/)) {
    if (line.startsWith("data:")) {
      const payload = line.slice(5).trim();
      if (payload && payload !== "[DONE]") return JSON.parse(payload);
    }
  }
  return trimmed;
}
