// Multi-persona scenario script runner. Invoked by `deno task as script <file>`.
//
// A script is a JSON(C) array of step objects:
//
//   [
//     {
//       "as": "alice",
//       "tool": "open_receptive_window",
//       "args": { "duration_seconds": 120 },
//       "capture": "window"
//     },
//     {
//       "as": "justin",
//       "tool": "send_invitation",
//       "args": {
//         "receiver_domain": "localhost:8000",
//         "shortcode": "${window.shortcode}",
//         "communication_terms": {
//           "categories": ["correspondence"],
//           "max_content_rating": "G"
//         }
//       },
//       "capture": "inv"
//     },
//     { "as": "alice", "tool": "list_invitations", "args": {} }
//   ]
//
// `${name.path.into.captured.result}` placeholders embedded anywhere in `args`
// (including nested values) are resolved against previously captured results.

import { parse as parseJsonc } from "@std/jsonc";
import {
  PersonaCallError,
  type PersonaClient,
  personaClient,
} from "./persona-client.ts";

interface ScriptStep {
  as: string;
  tool: string;
  args?: Record<string, unknown>;
  capture?: string;
  description?: string;
}

export async function runPersonaScript(file: string): Promise<void> {
  const raw = await Deno.readTextFile(file);
  const parsed = parseJsonc(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`Script ${file} must be a JSON array of steps.`);
  }
  const steps = parsed as unknown as ScriptStep[];

  const clients = new Map<string, PersonaClient>();
  const captures: Record<string, unknown> = {};

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (!step || typeof step !== "object") {
      throw new Error(`Step ${i + 1} is not an object.`);
    }
    if (typeof step.as !== "string" || typeof step.tool !== "string") {
      throw new Error(`Step ${i + 1} requires \`as\` and \`tool\` strings.`);
    }

    let client = clients.get(step.as);
    if (!client) {
      client = await personaClient(step.as);
      clients.set(step.as, client);
    }

    const args = substitute(step.args ?? {}, captures) as Record<
      string,
      unknown
    >;

    const label = step.description ?? step.tool;
    console.error(`[${i + 1}] ${step.as} -> ${label}`);
    try {
      const result = await client.call(step.tool, args);
      if (step.capture) captures[step.capture] = result;
      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      if (err instanceof PersonaCallError) {
        console.error(
          `step ${i + 1} failed (${step.as} -> ${step.tool}): ${err.message}`,
        );
      }
      throw err;
    }
  }
}

/** Recursively substitute `${name.path}` placeholders in any JSON value. */
function substitute(
  value: unknown,
  captures: Record<string, unknown>,
): unknown {
  if (typeof value === "string") return substituteString(value, captures);
  if (Array.isArray(value)) {
    return value.map((v) => substitute(v, captures));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = substitute(v, captures);
    }
    return out;
  }
  return value;
}

const PLACEHOLDER = /^\$\{([^}]+)\}$/;
const PLACEHOLDER_GLOBAL = /\$\{([^}]+)\}/g;

function substituteString(
  s: string,
  captures: Record<string, unknown>,
): unknown {
  const whole = s.match(PLACEHOLDER);
  if (whole) {
    // Whole-string placeholder preserves the captured value's type.
    return resolvePath(captures, whole[1]);
  }
  return s.replace(PLACEHOLDER_GLOBAL, (_, path: string) => {
    const v = resolvePath(captures, path);
    if (v === undefined || v === null) return "";
    return typeof v === "string" ? v : JSON.stringify(v);
  });
}

function resolvePath(root: unknown, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = root;
  for (const part of parts) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}
