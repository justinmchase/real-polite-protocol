import {
  asPercent,
  collectFiles,
  getArgValue,
  hasFlag,
  toRelative,
} from "./common.ts";

const root = Deno.cwd();
const args = Deno.args;
const json = hasFlag(args, "--json");
const scope = (getArgValue(args, "--scope") ?? "all").toLowerCase();
const requirementsPrefix = getArgValue(args, "--requirements-prefix") ??
  deriveRequirementsPrefix(scope);

const specPath = `${root}/spec/rpp-spec.md`;
const spec = await Deno.readTextFile(specPath);

const catalogSection = extractSection(
  spec,
  "## 12. MCP Tool Catalog",
  "## 13. Error Model",
);
const rfcTools = extractRfcToolsByScope(catalogSection, scope);

const allRequirementPaths = await collectFiles(
  `${root}/.github/requirements`,
  ".requirement.md",
);
const requirementPaths = allRequirementPaths.filter((path) => {
  const relative = toRelative(path, `${root}/.github/requirements`);
  if (!requirementsPrefix) {
    return true;
  }
  return relative === requirementsPrefix ||
    relative.startsWith(`${requirementsPrefix}/`);
});
const requirements = await Promise.all(
  requirementPaths.map((path) => Deno.readTextFile(path)),
);
const joinedRequirements = requirements.join("\n\n").toLowerCase();

const uncoveredTools = rfcTools.filter((tool) => {
  const snake = tool.toLowerCase();
  const dashed = snake.replace(/_/g, "-");
  return !joinedRequirements.includes(snake) &&
    !joinedRequirements.includes(dashed);
});

const coveredTools = rfcTools.length - uncoveredTools.length;
const coveragePercent = asPercent(coveredTools, rfcTools.length);

const result = {
  scope,
  requirementsPrefix: requirementsPrefix ?? "",
  rfcToolCount: rfcTools.length,
  requirementDocsCount: requirementPaths.length,
  coveredTools,
  uncoveredToolCount: uncoveredTools.length,
  rfcRequirementCoveragePercent: coveragePercent,
  scoreLine:
    `${coveredTools}/${rfcTools.length} RFC tools represented by requirements (${coveragePercent}%)`,
  uncoveredTools,
};

if (json) {
  console.log(JSON.stringify(result, null, 2));
  Deno.exit(0);
}

console.log("RFC -> Requirement Coverage");
console.log(result.scoreLine);
console.log(`Scope: ${result.scope}`);
if (result.requirementsPrefix) {
  console.log(`Requirements prefix filter: ${result.requirementsPrefix}`);
}
console.log(`RFC MCP tools: ${result.rfcToolCount}`);
console.log(`Requirement docs scanned: ${result.requirementDocsCount}`);
console.log(
  `Missing tool requirement representation: ${result.uncoveredToolCount}`,
);

if (result.uncoveredTools.length) {
  console.log("\nRFC tools missing requirement representation:");
  for (const tool of result.uncoveredTools) {
    console.log(`- ${tool}`);
  }
}

function extractSection(
  content: string,
  startMarker: string,
  endMarker: string,
): string {
  const start = content.indexOf(startMarker);
  if (start < 0) {
    return "";
  }
  const end = content.indexOf(endMarker, start + startMarker.length);
  if (end < 0) {
    return content.slice(start);
  }
  return content.slice(start, end);
}

function extractRfcToolNames(section: string): string[] {
  const names = new Set<string>();
  const regex = /`([a-z]+(?:_[a-z]+)+)`/g;
  // Tool names are the first column of Markdown tables in §12. The first
  // column always starts after the leading `|` and ends at the next `|`.
  // Restricting extraction to that first cell avoids matching field names
  // (`remote_credential`, `key_id`, etc.) that appear in description cells.
  for (const rawLine of section.split("\n")) {
    const line = rawLine.trimStart();
    if (!line.startsWith("|")) {
      continue;
    }
    const afterLeading = line.slice(1);
    const firstSep = afterLeading.indexOf("|");
    if (firstSep < 0) {
      continue;
    }
    const firstCell = afterLeading.slice(0, firstSep);
    if (/^\s*:?-+:?\s*$/.test(firstCell)) {
      continue; // skip table separator rows like |---|---|
    }
    let match: RegExpExecArray | null = null;
    while ((match = regex.exec(firstCell)) !== null) {
      names.add(match[1]);
    }
  }
  return Array.from(names).sort();
}

function extractRfcToolsByScope(section: string, scopeValue: string): string[] {
  if (scopeValue === "all") {
    return extractRfcToolNames(section);
  }

  const byHeading = {
    messaging: extractToolsInSection(
      section,
      "### 12.1 Messaging Tools",
      "### 12.2 Invitation Tools",
    ),
    invitation: extractToolsInSection(
      section,
      "### 12.2 Invitation Tools",
      "### 12.3 Receptive Policy Tools",
    ),
    receptive: extractToolsInSection(
      section,
      "### 12.3 Receptive Policy Tools",
      "### 12.4 Contact Tools",
    ),
    contact: extractToolsInSection(
      section,
      "### 12.4 Contact Tools",
      "### 12.5 Identity Tools",
    ),
    account: extractToolsInSection(
      section,
      "### 12.5 Identity Tools",
      "### 12.6 Domain Management — Identity and Configuration",
    ),
    domainIdentity: extractToolsInSection(
      section,
      "### 12.6 Domain Management — Identity and Configuration",
      "### 12.7 Domain Management — User Verification",
    ),
    domainVerification: extractToolsInSection(
      section,
      "### 12.7 Domain Management — User Verification",
      "### 12.8 Domain Management — Contact Information",
    ),
    domainContact: extractToolsInSection(
      section,
      "### 12.8 Domain Management — Contact Information",
      "### 12.9 Pagination",
    ),
  };

  if (scopeValue === "listener") {
    return uniq([
      ...byHeading.messaging,
      ...byHeading.invitation,
      ...byHeading.receptive,
      ...byHeading.contact,
      ...byHeading.account,
    ]);
  }

  if (scopeValue === "account") {
    return uniq(byHeading.account);
  }

  if (scopeValue === "domain-admin" || scopeValue === "domain") {
    return uniq([
      ...byHeading.domainIdentity,
      ...byHeading.domainVerification,
      ...byHeading.domainContact,
    ]);
  }

  return extractRfcToolNames(section);
}

function extractToolsInSection(
  content: string,
  startMarker: string,
  endMarker: string,
): string[] {
  return extractRfcToolNames(extractSection(content, startMarker, endMarker));
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values)).sort();
}

function deriveRequirementsPrefix(scopeValue: string): string | undefined {
  if (scopeValue === "account") {
    return "account";
  }
  return undefined;
}
