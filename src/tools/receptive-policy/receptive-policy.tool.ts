import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthInfo } from "../../context.ts";
import type { ReceptivePolicyManager } from "../../managers/mod.ts";
import { toolResult, withToolErrorHandling } from "../tool-result.ts";

const DomainFilterRuleSchema = z.object({
  action: z.enum(["allow", "block"]).describe(
    'Filter action: "allow" or "block"',
  ),
  pattern: z.string().describe(
    "Glob pattern matched against the sender domain (case-insensitive)",
  ),
});

const DomainFilterSchema = z.object({
  rules: z.array(DomainFilterRuleSchema).describe(
    "Ordered list of allow/block rules. First matching rule wins. Unmatched domains are blocked.",
  ),
});

const ReceptivePolicyOutputSchema = {
  policy_id: z.string().uuid().describe("Unique identifier for this policy"),
  oid: z.string().describe("User object identifier"),
  mode: z.enum(["all", "domain_filter", "closed"]).describe(
    'Receptive mode: "all", "domain_filter", or "closed"',
  ),
  domain_filter: DomainFilterSchema.optional().describe(
    "Domain filter rules applied when mode is domain_filter",
  ),
  receptive_until: z.iso.datetime().optional().describe(
    "ISO 8601 expiry timestamp for time-bounded policies",
  ),
  created_at: z.iso.datetime().describe(
    "ISO 8601 timestamp when this policy was created",
  ),
};

const ReceptivePoliciesOutputSchema = {
  policies: z.array(z.object(ReceptivePolicyOutputSchema)).describe(
    "List of active receptive policies for this user",
  ),
  page_size: z.number().int().describe("Number of results returned"),
};

const GetReceptivePoliciesInputSchema = {
  page_size: z.number().int().min(1).max(100).optional().describe(
    "Maximum number of results to return (default 50)",
  ),
};

const AddReceptivePolicyInputSchema = {
  mode: z.enum(["all", "domain_filter", "closed"]).describe(
    'Receptive mode: "all" accepts any sender, "domain_filter" applies rules, "closed" blocks all invitations',
  ),
  domain_filter: DomainFilterSchema.optional().describe(
    "Domain filter rules to apply when mode is domain_filter",
  ),
};

const OpenReceptiveWindowInputSchema = {
  duration_seconds: z.number().int().min(1).describe(
    "Duration in seconds for which the window should remain open",
  ),
  scope: z.enum(["all", "domain_filter"]).optional().describe(
    'Receptive scope during the window: "all" (default) or "domain_filter"',
  ),
  domain_filter: DomainFilterSchema.optional().describe(
    "Domain filter to apply during the window when scope is domain_filter",
  ),
};

type GetReceptivePoliciesArgs = z.infer<
  z.ZodObject<typeof GetReceptivePoliciesInputSchema>
>;

type AddReceptivePolicyArgs = z.infer<
  z.ZodObject<typeof AddReceptivePolicyInputSchema>
>;

type OpenReceptiveWindowArgs = z.infer<
  z.ZodObject<typeof OpenReceptiveWindowInputSchema>
>;

export class ReceptivePolicyTool {
  constructor(
    private readonly receptivePolicyManager: ReceptivePolicyManager,
  ) {}

  register(server: McpServer, auth: AuthInfo): void {
    server.registerTool(
      "get_receptive_policies",
      {
        description:
          "List all receptive policies for the authenticated user. Returns an empty list if no policies have been added (implying closed/not receptive).",
        inputSchema: GetReceptivePoliciesInputSchema,
        outputSchema: ReceptivePoliciesOutputSchema,
      },
      withToolErrorHandling(async (params: GetReceptivePoliciesArgs) => {
        const all = await this.receptivePolicyManager.getPolicies(auth.oid);
        const pageSize = params.page_size ?? 50;
        const policies = all.slice(0, pageSize);
        return toolResult({ policies, page_size: policies.length });
      }),
    );

    server.registerTool(
      "add_receptive_policy",
      {
        description:
          'Add a new receptive policy. Policies stack — multiple can be active simultaneously. Supports modes: "all", "domain_filter", or "closed".',
        inputSchema: AddReceptivePolicyInputSchema,
        outputSchema: ReceptivePolicyOutputSchema,
      },
      withToolErrorHandling(async (params: AddReceptivePolicyArgs) => {
        const policy = await this.receptivePolicyManager.addPolicy(
          auth.oid,
          params.mode,
          params.domain_filter,
        );
        return toolResult(policy);
      }),
    );

    server.registerTool(
      "open_receptive_window",
      {
        description:
          "Add a time-bounded receptive policy. Windows stack with other policies — opening a new window does not remove existing ones. Recommended for proximity pairing.",
        inputSchema: OpenReceptiveWindowInputSchema,
        outputSchema: ReceptivePolicyOutputSchema,
      },
      withToolErrorHandling(async (params: OpenReceptiveWindowArgs) => {
        const policy = await this.receptivePolicyManager.openWindow(
          auth.oid,
          params.duration_seconds,
          params.scope ?? "all",
          params.domain_filter,
        );
        return toolResult(policy);
      }),
    );
  }
}
