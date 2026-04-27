#!/usr/bin/env -S deno run -A
/**
 * Requirement ↔ Test extractor.
 *
 * Walks `.github/requirements/**` and, for each `*.requirement.md`:
 *   1. Parses YAML frontmatter `id` + `title`.
 *   2. Extracts normative bullet statements (lines beginning `- ` that contain
 *      a MUST/SHOULD/MAY/REQUIRED keyword), folding indented continuation lines.
 *   3. Locates the mirrored `src/requirements/**\/<basename>.requirement.test.ts`.
 *   4. Extracts the first string argument from every `t.step("…", …)` call.
 *
 * Emits a single JSON document on stdout. Used by the `/evaluate` skill so the
 * agent can perform semantic closure scoring without re-reading every file.
 *
 * Usage:
 *   deno run -A .github/skills/evaluate/scripts/extract.ts [--scope <category>]
 */

import { walk } from "@std/fs/walk";
import { parse as parseYaml } from "@std/yaml";
import { relative, resolve } from "@std/path";

const REPO_ROOT = resolve(
  new URL("../../../..", import.meta.url).pathname,
);
const REQ_ROOT = resolve(REPO_ROOT, ".github/requirements");
const TEST_ROOT = resolve(REPO_ROOT, "src/requirements");

interface Requirement {
  id: string;
  title: string;
  doc_path: string;
  test_path: string | null;
  statements: string[];
  test_steps: string[];
}

interface Category {
  name: string;
  requirements: Requirement[];
}

interface Report {
  generated_at: string;
  scope: string;
  categories: Category[];
}

const NORMATIVE_RE = /\b(MUST(?: NOT)?|SHOULD(?: NOT)?|MAY|REQUIRED|SHALL)\b/;

function parseScope(): string | null {
  const args = Deno.args;
  const i = args.indexOf("--scope");
  if (i >= 0 && i + 1 < args.length) return args[i + 1];
  return null;
}

function splitFrontmatter(
  text: string,
): { frontmatter: Record<string, unknown>; body: string } {
  if (!text.startsWith("---")) return { frontmatter: {}, body: text };
  const end = text.indexOf("\n---", 3);
  if (end < 0) return { frontmatter: {}, body: text };
  const yaml = text.slice(3, end).trim();
  const body = text.slice(end + 4);
  try {
    const fm = parseYaml(yaml) as Record<string, unknown>;
    return { frontmatter: fm ?? {}, body };
  } catch {
    return { frontmatter: {}, body };
  }
}

/**
 * Extract normative bullet statements from a requirement doc body.
 * Bullet lines start with `- `; continuation lines indented by 2+ spaces are
 * appended to the prior bullet. Only bullets that mention a normative keyword
 * (MUST/SHOULD/MAY/REQUIRED/SHALL) are kept.
 */
function extractStatements(body: string): string[] {
  const lines = body.split("\n");
  const bullets: string[] = [];
  let current: string | null = null;

  for (const line of lines) {
    if (/^- /.test(line)) {
      if (current !== null) bullets.push(current);
      current = line.replace(/^- /, "").trim();
    } else if (current !== null && /^\s{2,}\S/.test(line)) {
      current += " " + line.trim();
    } else if (current !== null && line.trim() === "") {
      // Blank line ends the current bullet.
      bullets.push(current);
      current = null;
    } else if (current !== null) {
      // Heading or other top-level prose — flush.
      bullets.push(current);
      current = null;
    }
  }
  if (current !== null) bullets.push(current);

  return bullets
    .map((b) => b.replace(/\s+/g, " ").trim())
    .filter((b) => NORMATIVE_RE.test(b));
}

/**
 * Extract `t.step("...", ...)` first-argument strings from a test file.
 * Handles both single-line and multi-line `t.step(\n  "name",\n …)` forms.
 */
function extractTestSteps(source: string): string[] {
  const steps: string[] = [];
  // Match t.step(<whitespace/newlines>"<name>"  — captures the first string literal.
  const re = /t\.step\(\s*(["'`])((?:\\.|(?!\1).)*?)\1/g;
  for (const m of source.matchAll(re)) {
    steps.push(m[2].replace(/\\"/g, '"').replace(/\s+/g, " ").trim());
  }
  return steps;
}

async function findTestFile(docPath: string): Promise<string | null> {
  // .github/requirements/<cat>/<file>.requirement.md
  // -> src/requirements/<cat>/<file>.requirement.test.ts
  const rel = relative(REQ_ROOT, docPath);
  const expected = resolve(
    TEST_ROOT,
    rel.replace(/\.requirement\.md$/, ".requirement.test.ts"),
  );
  try {
    const stat = await Deno.stat(expected);
    if (stat.isFile) return expected;
  } catch {
    // Not at mirrored path — fall back to scanning by id.
  }
  return null;
}

async function main() {
  const scope = parseScope();
  const categories = new Map<string, Requirement[]>();

  for await (
    const entry of walk(REQ_ROOT, {
      includeDirs: false,
      exts: [".md"],
      match: [/\.requirement\.md$/],
    })
  ) {
    const rel = relative(REQ_ROOT, entry.path);
    const cat = rel.split("/")[0] ?? "_root";
    if (scope && cat !== scope) continue;

    const text = await Deno.readTextFile(entry.path);
    const { frontmatter, body } = splitFrontmatter(text);
    const id = String(frontmatter.id ?? "").trim();
    const title = String(frontmatter.title ?? "").trim();
    if (!id) continue;

    const statements = extractStatements(body);
    const testPath = await findTestFile(entry.path);
    const testSteps = testPath
      ? extractTestSteps(await Deno.readTextFile(testPath))
      : [];

    const list = categories.get(cat) ?? [];
    list.push({
      id,
      title,
      doc_path: relative(REPO_ROOT, entry.path),
      test_path: testPath ? relative(REPO_ROOT, testPath) : null,
      statements,
      test_steps: testSteps,
    });
    categories.set(cat, list);
  }

  // Stable ordering.
  const sortedCategories: Category[] = [...categories.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, requirements]) => ({
      name,
      requirements: requirements.sort((a, b) => a.id.localeCompare(b.id)),
    }));

  const report: Report = {
    generated_at: new Date().toISOString(),
    scope: scope ?? "all",
    categories: sortedCategories,
  };

  console.log(JSON.stringify(report, null, 2));
}

if (import.meta.main) await main();
