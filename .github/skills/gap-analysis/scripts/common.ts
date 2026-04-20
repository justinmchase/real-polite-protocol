export interface RequirementDoc {
  path: string;
  relative: string;
  mirroredTestPath: string;
  id?: string;
}

export interface RequirementTest {
  path: string;
  relative: string;
  mirroredDocPath: string;
  referencedIds: string[];
}

export async function collectFiles(
  baseDir: string,
  endsWith: string,
): Promise<string[]> {
  const output: string[] = [];
  await walk(baseDir, output, endsWith);
  output.sort();
  return output;
}

async function walk(
  dir: string,
  output: string[],
  endsWith: string,
): Promise<void> {
  let entries: Deno.DirEntry[] = [];
  try {
    entries = await readDirArray(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory) {
      await walk(full, output, endsWith);
      continue;
    }
    if (entry.isFile && full.endsWith(endsWith)) {
      output.push(full);
    }
  }
}

async function readDirArray(dir: string): Promise<Deno.DirEntry[]> {
  const entries: Deno.DirEntry[] = [];
  for await (const entry of Deno.readDir(dir)) {
    entries.push(entry);
  }
  return entries;
}

export function toRelative(path: string, root: string): string {
  const normalizedRoot = root.endsWith("/") ? root.slice(0, -1) : root;
  if (path.startsWith(`${normalizedRoot}/`)) {
    return path.slice(normalizedRoot.length + 1);
  }
  return path;
}

export function requirementDocToMirroredTestPath(
  relativeDocPath: string,
): string {
  return `src/requirements/${relativeDocPath}`.replace(
    /\.requirement\.md$/,
    ".requirement.test.ts",
  );
}

export function requirementTestToMirroredDocPath(
  relativeTestPath: string,
): string {
  return `.github/requirements/${relativeTestPath}`.replace(
    /\.requirement\.test\.ts$/,
    ".requirement.md",
  );
}

export function parseRequirementId(content: string): string | undefined {
  const match = content.match(/^id:\s*([^\n\r]+)\s*$/m);
  return match?.[1]?.trim();
}

export function parseReferencedRequirementIds(content: string): string[] {
  const ids = new Set<string>();
  const regex = /req:([a-z0-9-]+)/gi;
  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(content)) !== null) {
    ids.add(match[1]);
  }
  return Array.from(ids).sort();
}

export function asPercent(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 100;
  }
  return Math.round((numerator / denominator) * 10000) / 100;
}

export function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

export function getArgValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0 || index + 1 >= args.length) {
    return undefined;
  }
  const value = args[index + 1];
  if (value.startsWith("--")) {
    return undefined;
  }
  return value;
}
