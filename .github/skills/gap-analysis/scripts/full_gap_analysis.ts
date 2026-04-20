type RequirementCoverage = {
  docsCount: number;
  testsCount: number;
  mirroredCovered: number;
  mirroredMissingCount: number;
  orphanTestsCount: number;
  idCoverageMissingCount: number;
  mirroredCoveragePercent: number;
  scoreLine: string;
  missingMirroredTests: Array<{ requirement: string; expectedTest: string }>;
  orphanTests: Array<{ test: string; expectedRequirement: string }>;
  missingIdCoverage: Array<{ requirement: string; id: string }>;
  unknownReferencedIds: string[];
};

type RfcCoverage = {
  rfcToolCount: number;
  requirementDocsCount: number;
  coveredTools: number;
  uncoveredToolCount: number;
  rfcRequirementCoveragePercent: number;
  scoreLine: string;
  uncoveredTools: string[];
};

const root = Deno.cwd();
const json = Deno.args.includes("--json");
const scope = getArgValue(Deno.args, "--scope") ?? "all";
const requirementsPrefix = getArgValue(Deno.args, "--requirements-prefix");

const reqCoverage = await runJson<RequirementCoverage>(
  `${root}/.github/skills/gap-analysis/scripts/requirement_test_coverage.ts`,
  scope,
  requirementsPrefix,
);
const rfcCoverage = await runJson<RfcCoverage>(
  `${root}/.github/skills/gap-analysis/scripts/rfc_requirement_coverage.ts`,
  scope,
  requirementsPrefix,
);

const significantGaps: string[] = [];
if (reqCoverage.mirroredMissingCount > 0) {
  significantGaps.push(
    `${reqCoverage.mirroredMissingCount} requirements missing mirrored tests`,
  );
}
if (reqCoverage.idCoverageMissingCount > 0) {
  significantGaps.push(
    `${reqCoverage.idCoverageMissingCount} requirement IDs not referenced in tests`,
  );
}
if (reqCoverage.orphanTestsCount > 0) {
  significantGaps.push(
    `${reqCoverage.orphanTestsCount} orphan requirement tests with no matching requirement doc`,
  );
}
if (rfcCoverage.uncoveredToolCount > 0) {
  significantGaps.push(
    `${rfcCoverage.uncoveredToolCount} RFC MCP tools missing requirement coverage`,
  );
}

const output = {
  scope,
  requirementsPrefix: requirementsPrefix ?? "",
  requirementToTest: reqCoverage,
  rfcToRequirement: rfcCoverage,
  coverageScore: reqCoverage.scoreLine,
  significantGaps,
};

if (json) {
  console.log(JSON.stringify(output, null, 2));
  Deno.exit(0);
}

console.log("Gap Analysis Summary");
console.log(`Scope: ${scope}`);
if (requirementsPrefix) {
  console.log(`Requirements prefix filter: ${requirementsPrefix}`);
}
console.log(`Requirement -> test: ${reqCoverage.scoreLine}`);
console.log(`RFC -> requirement: ${rfcCoverage.scoreLine}`);

if (!significantGaps.length) {
  console.log("Significant gaps: none detected");
  Deno.exit(0);
}

console.log("Significant gaps:");
for (const gap of significantGaps) {
  console.log(`- ${gap}`);
}

function getArgValue(args: string[], name: string): string | undefined {
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

async function runJson<T>(
  scriptPath: string,
  scopeValue: string,
  requirementsPrefixValue?: string,
): Promise<T> {
  const commandArgs = [
    "run",
    "-A",
    scriptPath,
    "--json",
    "--scope",
    scopeValue,
  ];
  if (requirementsPrefixValue) {
    commandArgs.push("--requirements-prefix", requirementsPrefixValue);
  }

  const command = new Deno.Command("deno", {
    args: commandArgs,
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stdout, stderr } = await command.output();
  if (code !== 0) {
    const errorText = new TextDecoder().decode(stderr);
    throw new Error(`Failed to run ${scriptPath}: ${errorText}`);
  }
  const text = new TextDecoder().decode(stdout);
  return JSON.parse(text) as T;
}
