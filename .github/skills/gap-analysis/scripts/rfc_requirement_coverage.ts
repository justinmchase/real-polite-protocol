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
  "## 10B. MCP Tool Catalog",
  "## 11. Error Model",
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
  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(section)) !== null) {
    names.add(match[1]);
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
      "### 10B.1 Messaging Tools",
      "### 10B.2 Group Tools",
    ),
    group: extractToolsInSection(
      section,
      "### 10B.2 Group Tools",
      "### 10B.3 Receipt Tools",
    ),
    receipt: extractToolsInSection(
      section,
      "### 10B.3 Receipt Tools",
      "### 10B.4 Invitation Tools",
    ),
    invitation: extractToolsInSection(
      section,
      "### 10B.4 Invitation Tools",
      "### 10B.5 Receptive Policy Tools",
    ),
    receptive: extractToolsInSection(
      section,
      "### 10B.5 Receptive Policy Tools",
      "### 10B.6 Identity Tools",
    ),
    account: extractToolsInSection(
      section,
      "### 10B.6 Identity Tools",
      "### 10B.7 Domain Management — Identity and Configuration",
    ),
    domainIdentity: extractToolsInSection(
      section,
      "### 10B.7 Domain Management — Identity and Configuration",
      "### 10B.8 Domain Management — User Verification",
    ),
    domainVerification: extractToolsInSection(
      section,
      "### 10B.8 Domain Management — User Verification",
      "### 10B.9 Domain Management — Contact Information",
    ),
    domainContact: extractToolsInSection(
      section,
      "### 10B.9 Domain Management — Contact Information",
      "## 11. Error Model",
    ),
  };

  if (scopeValue === "listener") {
    return uniq([
      ...byHeading.messaging,
      ...byHeading.group,
      ...byHeading.receipt,
      ...byHeading.invitation,
      ...byHeading.receptive,
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
