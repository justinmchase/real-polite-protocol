// Test-user CLI for the local RPP server.
//
// Usage:
//   deno task as <persona> <subcommand> [options]
//
// Examples:
//   deno task as alice token
//   deno task as alice set-display-name "Alice Liddell"
//   deno task as alice open-window --duration 3600
//   deno task as alice send-message --to <contact-id> --body "hi"
//
// Personas are stored in .dev/users/<name>.json (auto-created). Edit those
// files to grant roles (e.g. ["domain.admin"]). The server must be started
// with RPP_DEV_MODE=1 (see `deno task dev`) to accept the minted tokens.

import { Command } from "@cliffy/command";
import { mintToken } from "./mint.ts";
import { loadPersona, type Persona } from "./personas.ts";

const SERVER = Deno.env.get("RPP_SERVER") ?? "http://localhost:8000";
const AUDIENCE = Deno.env.get("RPP_AUDIENCE") ??
  `api://${
    Deno.env.get("AZURE_API_APP_CLIENT_ID") ??
      "03c7765e-c8c3-462f-a155-d863f44ea1ed"
  }`;
const API_APP_CLIENT_ID = Deno.env.get("AZURE_API_APP_CLIENT_ID") ??
  "03c7765e-c8c3-462f-a155-d863f44ea1ed";

interface Ctx {
  persona: Persona;
  token: string;
}

let _ctx: Ctx | undefined;
async function ctx(): Promise<Ctx> {
  if (_ctx) return _ctx;
  const personaName = Deno.args[0];
  if (!personaName || personaName.startsWith("-")) {
    console.error(
      "Usage: deno task as <persona> <subcommand> [options]\n" +
        "Run `deno task as <persona> --help` for subcommands.",
    );
    Deno.exit(2);
  }
  const persona = await loadPersona(personaName);
  const token = await mintToken({
    persona,
    audience: AUDIENCE,
    apiAppClientId: API_APP_CLIENT_ID,
  });
  _ctx = { persona, token };
  return _ctx;
}

async function callTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { token, persona } = await ctx();
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name, arguments: args },
  };
  const res = await fetch(`${SERVER}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "accept": "application/json, text/event-stream",
      "authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`[${persona.name}] HTTP ${res.status}: ${text}`);
    Deno.exit(1);
  }
  // Streamable HTTP transport may return SSE; pull the first JSON-RPC message.
  const json = parseMcpResponse(text);
  if (json && typeof json === "object" && "error" in json) {
    console.error(`[${persona.name}] MCP error:`, json.error);
    Deno.exit(1);
  }
  const result = (json as { result?: { content?: Array<{ text?: string }> } })
    ?.result;
  // MCP tool results wrap JSON in a text content block; unwrap when present.
  const firstText = result?.content?.[0]?.text;
  if (typeof firstText === "string") {
    try {
      return JSON.parse(firstText);
    } catch {
      return firstText;
    }
  }
  return result;
}

function parseMcpResponse(body: string): unknown {
  const trimmed = body.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return JSON.parse(trimmed);
  }
  // SSE: look for `data:` lines and parse the first valid JSON payload.
  for (const line of trimmed.split(/\r?\n/)) {
    if (line.startsWith("data:")) {
      const payload = line.slice(5).trim();
      if (payload && payload !== "[DONE]") return JSON.parse(payload);
    }
  }
  return trimmed;
}

function print(value: unknown): void {
  if (typeof value === "string") console.log(value);
  else console.log(JSON.stringify(value, null, 2));
}

// Parse `--arg key=value` (repeatable). Values are JSON-parsed when possible,
// otherwise kept as raw strings.
function parseArgs(pairs: string[] | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const pair of pairs ?? []) {
    const idx = pair.indexOf("=");
    if (idx < 0) {
      console.error(`Invalid --arg "${pair}", expected key=value`);
      Deno.exit(2);
    }
    const key = pair.slice(0, idx);
    const raw = pair.slice(idx + 1);
    try {
      out[key] = JSON.parse(raw);
    } catch {
      out[key] = raw;
    }
  }
  return out;
}

const program = new Command()
  .name("test-user")
  .description("Act on the local RPP server as a named dev persona.")
  .action(function () {
    this.showHelp();
  });

program.command("token", "Print the dev JWT for this persona.")
  .action(async () => {
    const { token } = await ctx();
    console.log(token);
  });

program.command("whoami", "Print the persona record.")
  .action(async () => {
    const { persona } = await ctx();
    print(persona);
  });

program.command("call <tool:string>", "Call any MCP tool by name.")
  .option(
    "-a, --arg <pair:string>",
    "Tool argument as key=value (JSON value if parseable). Repeatable.",
    { collect: true },
  )
  .action(async ({ arg }, tool) => {
    const args = parseArgs(arg as string[] | undefined);
    print(await callTool(tool, args));
  });

program.command("set-display-name <name:string>")
  .description("Set this persona's display name.")
  .action(async (_o, name) => {
    print(await callTool("set_display_name", { display_name: name }));
  });

program.command("get-display-name")
  .action(async () => print(await callTool("get_display_name", {})));

program.command("get-permissions")
  .action(async () => print(await callTool("get_permissions", {})));

program.command("open-window")
  .description("Open a receptive window and print the shortcode.")
  .option("-d, --duration <seconds:number>", "Window duration in seconds.", {
    default: 3600,
  })
  .option(
    "-s, --scope <scope:string>",
    "Window scope (domain | invitation).",
  )
  .option(
    "--domain <domain:string>",
    "Restrict the window to a remote domain.",
  )
  .action(async ({ duration, scope, domain }) => {
    const args: Record<string, unknown> = { duration_seconds: duration };
    if (scope) args.scope = scope;
    if (domain) args.domain_filter = domain;
    print(await callTool("open_receptive_window", args));
  });

program.command("add-policy")
  .description("Add a receptive policy.")
  .option("-m, --mode <mode:string>", "Policy mode (open|closed|...)", {
    required: true,
  })
  .option("--domain <domain:string>", "Restrict to remote domain.")
  .option(
    "--contact <id:string>",
    "Restrict to a contact id. Repeatable.",
    { collect: true },
  )
  .action(async ({ mode, domain, contact }) => {
    const args: Record<string, unknown> = { mode };
    if (domain) args.domain_filter = domain;
    if (contact && (contact as string[]).length > 0) args.contacts = contact;
    print(await callTool("add_receptive_policy", args));
  });

program.command("list-policies")
  .action(async () => print(await callTool("get_receptive_policies", {})));

program.command("remove-policy <id:string>")
  .action(async (_o, id) =>
    print(await callTool("remove_receptive_policy", { policy_id: id }))
  );

program.command("list-invitations")
  .option("--status <status:string>", "Filter by invitation status.")
  .option("--domain <domain:string>", "Filter by remote domain.")
  .action(async ({ status, domain }) => {
    const args: Record<string, unknown> = {};
    if (status) args.status = status;
    if (domain) args.remote_domain = domain;
    print(await callTool("list_invitations", args));
  });

program.command("list-sent-invitations")
  .option("--status <status:string>")
  .option("--domain <domain:string>")
  .action(async ({ status, domain }) => {
    const args: Record<string, unknown> = {};
    if (status) args.status = status;
    if (domain) args.remote_domain = domain;
    print(await callTool("list_sent_invitations", args));
  });

program.command("review-invitation <id:string>")
  .action(async (_o, id) =>
    print(await callTool("review_invitation", { invitation_id: id }))
  );

program.command("accept-invitation <id:string>")
  .option("--terms <json:string>", "Local terms as JSON object.", {
    required: true,
  })
  .option("--message <text:string>", "Optional acceptance message.")
  .action(async ({ terms, message }, id) => {
    const args: Record<string, unknown> = {
      invitation_id: id,
      local_terms: JSON.parse(terms),
    };
    if (message) args.message = message;
    print(await callTool("accept_invitation", args));
  });

program.command("reject-invitation <id:string>")
  .action(async (_o, id) =>
    print(await callTool("reject_invitation", { invitation_id: id }))
  );

program.command("cancel-invitation <id:string>")
  .action(async (_o, id) =>
    print(await callTool("cancel_invitation", { invitation_id: id }))
  );

program.command("send-invitation")
  .description("Send an invitation to a remote domain using a shortcode.")
  .option("--to <domain:string>", "Receiver domain.", { required: true })
  .option("--shortcode <code:string>", "Receiver shortcode.")
  .option("--policy <id:string>", "Receiver receptive policy id.")
  .option("--terms <json:string>", "Communication terms as JSON object.", {
    required: true,
  })
  .action(async ({ to, shortcode, policy, terms }) => {
    const args: Record<string, unknown> = {
      receiver_domain: to,
      communication_terms: JSON.parse(terms),
    };
    if (shortcode) args.shortcode = shortcode;
    if (policy) args.receptive_policy_id = policy;
    print(await callTool("send_invitation", args));
  });

program.command("list-contacts")
  .option("--blocked", "Show only blocked contacts.")
  .action(async ({ blocked }) => {
    const args: Record<string, unknown> = {};
    if (typeof blocked === "boolean") args.blocked = blocked;
    print(await callTool("list_contacts", args));
  });

program.command("send-message")
  .option("--to <contact_id:string>", "Destination contact id.", {
    required: true,
  })
  .option("--body <text:string>", "Message body.", { required: true })
  .option("--subject <text:string>", "Optional subject.")
  .option("--category <name:string>", "Message category.", {
    default: "direct",
  })
  .option("--rating <rating:string>", "Content rating.", { default: "general" })
  .action(async ({ to, body, subject, category, rating }) => {
    const args: Record<string, unknown> = {
      contact_id: to,
      category,
      content_rating: rating,
      body,
    };
    if (subject) args.subject = subject;
    print(await callTool("send_message", args));
  });

program.command("list-messages")
  .option("--contact <id:string>")
  .option("--unread", "Only unread messages.")
  .option("--category <name:string>")
  .action(async ({ contact, unread, category }) => {
    const args: Record<string, unknown> = {};
    if (contact) args.contact_id = contact;
    if (unread) args.read = false;
    if (category) args.category = category;
    print(await callTool("list_messages", args));
  });

program.command("get-message <id:string>")
  .action(async (_o, id) =>
    print(await callTool("get_message", { message_id: id }))
  );

program.command("mark-read <id...:string>")
  .action(async (_o, ...ids) =>
    print(await callTool("mark_read", { message_ids: ids }))
  );

program.command("reply <message_id:string>")
  .description(
    "Reply to a message by resolving its contact and calling send_message.",
  )
  .option("--body <text:string>", "Reply body.", { required: true })
  .option("--subject <text:string>")
  .option("--category <name:string>", { default: "direct" })
  .option("--rating <rating:string>", { default: "general" })
  .action(async ({ body, subject, category, rating }, messageId) => {
    const source = await callTool("get_message", { message_id: messageId }) as
      | { contact_id?: string; subject?: string }
      | undefined;
    if (!source?.contact_id) {
      console.error(`Cannot reply: message ${messageId} has no contact_id.`);
      Deno.exit(1);
    }
    const args: Record<string, unknown> = {
      contact_id: source.contact_id,
      category,
      content_rating: rating,
      body,
    };
    args.subject = subject ??
      (source.subject ? `Re: ${source.subject}` : undefined);
    if (args.subject === undefined) delete args.subject;
    print(await callTool("send_message", args));
  });

// Drop the first positional (persona) before handing off to cliffy.
await program.parse(Deno.args.slice(1));
