import {
  asPercent,
  collectFiles,
  getArgValue,
  hasFlag,
  parseReferencedRequirementIds,
  parseRequirementId,
  requirementDocToMirroredTestPath,
  requirementTestToMirroredDocPath,
  toRelative,
} from "./common.ts";

const root = Deno.cwd();
const args = Deno.args;
const json = hasFlag(args, "--json");
const scope = getArgValue(args, "--scope") ?? "all";
const requirementsPrefix = getArgValue(args, "--requirements-prefix") ??
  deriveRequirementsPrefix(scope);

const allDocsAbs = await collectFiles(`${root}/.github/requirements`, ".requirement.md");
const allTestsAbs = await collectFiles(`${root}/src/requirements`, ".requirement.test.ts");

const docsAbs = allDocsAbs.filter((path) => {
  const relative = toRelative(path, `${root}/.github/requirements`);
  return shouldIncludeRelative(relative, requirementsPrefix);
});
const testsAbs = allTestsAbs.filter((path) => {
  const relative = toRelative(path, `${root}/src/requirements`);
  return shouldIncludeRelative(relative, requirementsPrefix);
});

const docs = await Promise.all(
  docsAbs.map(async (path) => {
    const relative = toRelative(path, `${root}/.github/requirements`);
    const content = await Deno.readTextFile(path);
    const id = parseRequirementId(content);
    return {
      path,
      relative,
      mirroredTestPath: requirementDocToMirroredTestPath(relative),
      id,
    };
  }),
);

const tests = await Promise.all(
  testsAbs.map(async (path) => {
    const relative = toRelative(path, `${root}/src/requirements`);
    const content = await Deno.readTextFile(path);
    return {
      path,
      relative,
      mirroredDocPath: requirementTestToMirroredDocPath(relative),
      referencedIds: parseReferencedRequirementIds(content),
    };
  }),
);

const testPathSet = new Set(tests.map((t) => `src/requirements/${t.relative}`));
const docPathSet = new Set(docs.map((d) => `.github/requirements/${d.relative}`));

const missingMirroredTests = docs
  .filter((doc) => !testPathSet.has(doc.mirroredTestPath))
  .map((doc) => ({ requirement: `.github/requirements/${doc.relative}`, expectedTest: doc.mirroredTestPath }));

const orphanTests = tests
  .filter((test) => !docPathSet.has(test.mirroredDocPath))
  .map((test) => ({ test: `src/requirements/${test.relative}`, expectedRequirement: test.mirroredDocPath }));

const testReferencedIds = new Set<string>();
for (const test of tests) {
  for (const id of test.referencedIds) {
    testReferencedIds.add(id);
  }
}

const docsWithIds = docs.filter((d) => Boolean(d.id));
const missingIdCoverage = docsWithIds
  .filter((doc) => !testReferencedIds.has(doc.id!))
  .map((doc) => ({ requirement: `.github/requirements/${doc.relative}`, id: doc.id! }));

const idSet = new Set(docsWithIds.map((d) => d.id!));
const unknownReferencedIds = Array.from(testReferencedIds)
  .filter((id) => !idSet.has(id))
  .sort();

const mirroredCovered = docs.length - missingMirroredTests.length;
const coveragePercent = asPercent(mirroredCovered, docs.length);

const result = {
  scope,
  requirementsPrefix: requirementsPrefix ?? "",
  docsCount: docs.length,
  testsCount: tests.length,
  mirroredCovered,
  mirroredMissingCount: missingMirroredTests.length,
  orphanTestsCount: orphanTests.length,
  idCoverageMissingCount: missingIdCoverage.length,
  mirroredCoveragePercent: coveragePercent,
  scoreLine: `${mirroredCovered}/${docs.length} requirements covered by tests (${coveragePercent}%)`,
  missingMirroredTests,
  orphanTests,
  missingIdCoverage,
  unknownReferencedIds,
};

if (json) {
  console.log(JSON.stringify(result, null, 2));
  Deno.exit(0);
}

console.log("Requirement -> Test Coverage");
console.log(result.scoreLine);
console.log(`Scope: ${result.scope}`);
if (result.requirementsPrefix) {
  console.log(`Requirements prefix filter: ${result.requirementsPrefix}`);
}
console.log(`Requirement docs: ${result.docsCount}`);
console.log(`Requirement tests: ${result.testsCount}`);
console.log(`Missing mirrored tests: ${result.mirroredMissingCount}`);
console.log(`Orphan tests: ${result.orphanTestsCount}`);
console.log(`Requirements missing ID coverage: ${result.idCoverageMissingCount}`);
console.log(`Unknown req IDs referenced by tests: ${result.unknownReferencedIds.length}`);

if (result.missingMirroredTests.length) {
  console.log("\nMissing mirrored tests:");
  for (const gap of result.missingMirroredTests) {
    console.log(`- ${gap.requirement} -> expected ${gap.expectedTest}`);
  }
}

if (result.orphanTests.length) {
  console.log("\nOrphan tests:");
  for (const gap of result.orphanTests) {
    console.log(`- ${gap.test} -> expected ${gap.expectedRequirement}`);
  }
}

if (result.missingIdCoverage.length) {
  console.log("\nRequirement IDs with no test reference:");
  for (const gap of result.missingIdCoverage) {
    console.log(`- ${gap.id} (${gap.requirement})`);
  }
}

if (result.unknownReferencedIds.length) {
  console.log("\nUnknown requirement IDs referenced by tests:");
  for (const id of result.unknownReferencedIds) {
    console.log(`- ${id}`);
  }
}

function shouldIncludeRelative(relative: string, prefix: string | undefined): boolean {
  if (!prefix) {
    return true;
  }
  return relative === prefix || relative.startsWith(`${prefix}/`);
}

function deriveRequirementsPrefix(scopeValue: string): string | undefined {
  const scopeLower = scopeValue.toLowerCase();
  if (scopeLower === "account") {
    return "account";
  }
  if (scopeLower === "mcp-auth") {
    return "mcp/auth";
  }
  return undefined;
}
