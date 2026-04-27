/**
 * RPP token helper — reusable across client-side scripts.
 *
 * Usage:
 *   import { getToken } from "../../.github/skills/get-rpp-token/scripts/get-token.ts";
 *   const token = await getToken();
 *
 * Or copy this function directly into a standalone script.
 *
 * Resolution order:
 *   1. RPP_TOKEN env var (explicit override, no az required)
 *   2. `az account get-access-token` against the RPP Azure AD app
 *
 * Exits the process with a descriptive error if authentication fails.
 */

const RPP_API_ID = "03c7765e-c8c3-462f-a155-d863f44ea1ed";
const DEFAULT_SCOPE = `api://${RPP_API_ID}/.default`;

export async function getToken(): Promise<string> {
  const explicit = Deno.env.get("RPP_TOKEN");
  if (explicit) return explicit;

  const scope = Deno.env.get("RPP_AZ_SCOPE") ?? DEFAULT_SCOPE;
  console.log(`[rpp] Acquiring token via az CLI (scope: ${scope}) …`);

  let result: { code: number; stdout: string; stderr: string };
  try {
    const cmd = new Deno.Command("az", {
      args: [
        "account",
        "get-access-token",
        "--scope",
        scope,
        "--query",
        "accessToken",
        "-o",
        "tsv",
      ],
      stdout: "piped",
      stderr: "piped",
    });
    const out = await cmd.output();
    result = {
      code: out.code,
      stdout: new TextDecoder().decode(out.stdout).trim(),
      stderr: new TextDecoder().decode(out.stderr).trim(),
    };
  } catch {
    console.error(
      "[rpp] Error: `az` CLI not found. Install the Azure CLI or set RPP_TOKEN.",
    );
    Deno.exit(1);
  }

  if (result.code !== 0) {
    console.error("[rpp] Error: az account get-access-token failed.");
    if (result.stderr) console.error(result.stderr);
    console.error(
      "\nYou may not be logged in. Try:\n  az login\nthen re-run this command.",
    );
    Deno.exit(1);
  }

  if (!result.stdout) {
    console.error("[rpp] Error: az returned an empty token.");
    Deno.exit(1);
  }

  return result.stdout;
}
