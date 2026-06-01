// Per-persona identity used by the test-user CLI. Records live under
// .dev/users/<name>.json (gitignored) and are auto-created on first use.
//
// Hand-edit the JSON to add roles (e.g. ["domain.admin"]) when testing
// admin-only tools.

import { dirname, join } from "@std/path";

export interface Persona {
  name: string;
  oid: string;
  preferred_username: string;
  email: string;
  display_name: string;
  roles: string[];
}

const PERSONA_DIR = ".dev/users";

export async function loadPersona(name: string): Promise<Persona> {
  if (!/^[a-z][a-z0-9_-]*$/i.test(name)) {
    throw new Error(
      `Invalid persona name "${name}". Use letters, digits, _ or -.`,
    );
  }
  const path = join(PERSONA_DIR, `${name}.json`);
  try {
    const text = await Deno.readTextFile(path);
    return JSON.parse(text) as Persona;
  } catch {
    const persona = await generatePersona(name);
    await Deno.mkdir(dirname(path), { recursive: true });
    await Deno.writeTextFile(path, JSON.stringify(persona, null, 2));
    console.error(`[dev] Created persona at ${path}`);
    return persona;
  }
}

async function generatePersona(name: string): Promise<Persona> {
  // Deterministic oid: SHA-256 of `"rpp-dev:" + name` formatted as UUID.
  const data = new TextEncoder().encode(`rpp-dev:${name}`);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  const hex = Array.from(
    hash.slice(0, 16),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  const oid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${
    hex.slice(16, 20)
  }-${hex.slice(20, 32)}`;
  return {
    name,
    oid,
    preferred_username: `${name}@test.local`,
    email: `${name}@test.local`,
    display_name: name[0].toUpperCase() + name.slice(1),
    roles: [],
  };
}
