import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthInfo } from "../../context.ts";
import type { ReceptivePolicyManager } from "../../managers/mod.ts";
import { toolResult, withToolErrorHandling } from "../tool-result.ts";
import { outputDate } from "../date-schema.ts";

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
  mode: z.enum(["all", "domain_filter", "contact", "receipt", "closed"])
    .describe(
      'Receptive mode: "all", "domain_filter", "contact", "receipt", or "closed"',
    ),
  domain_filter: DomainFilterSchema.optional().describe(
    "Domain filter rules applied when mode is domain_filter",
  ),
  contact_ids: z.array(z.string().uuid()).optional().describe(
    "[Deprecated] Use contacts instead",
  ),
  contacts: z.array(z.object({
    domain: z.string().describe("Issuing hostname"),
    domain_id: z.string().uuid().describe("domain_id UUID scoped to domain"),
  })).optional().describe(
    "List of (domain, domain_id) pairs that may send invitations (mode: contact)",
  ),
  receipt_id: z.string().uuid().optional().describe(
    "Receipt ID this policy is bound to (mode: receipt)",
  ),
  receptive_until: outputDate().optional().describe(
    "ISO 8601 expiry timestamp for time-bounded policies",
  ),
  created_at: outputDate().describe(
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
  include_receipt_policies: z.boolean().optional().describe(
    'When true, include auto-created mode:"receipt" policies in the results. Defaults to false to reduce clutter.',
  ),
};

const AddReceptivePolicyInputSchema = {
  mode: z.enum(["all", "domain_filter", "contact", "closed"]).describe(
    'Receptive mode: "all" accepts any sender, "domain_filter" applies rules, "contact" accepts only listed domain_id UUIDs, "closed" explicitly rejects all senders',
  ),
  domain_filter: DomainFilterSchema.optional().describe(
    "Domain filter rules to apply when mode is domain_filter",
  ),
  contacts: z.array(z.object({
    domain: z.string().describe("Issuing hostname"),
    domain_id: z.string().uuid().describe("domain_id UUID scoped to domain"),
  })).optional().describe(
    "(domain, domain_id) pairs that may send invitations (required when mode is contact)",
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

const RemoveReceptivePolicyInputSchema = {
  policy_id: z.string().uuid().describe("ID of the policy to remove"),
};

const RemoveReceptivePolicyOutputSchema = {
  policy_id: z.string().uuid().describe("ID of the removed policy"),
  deleted: z.boolean().describe("Whether the policy was removed"),
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

type RemoveReceptivePolicyArgs = z.infer<
  z.ZodObject<typeof RemoveReceptivePolicyInputSchema>
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
        const includeReceipt = params.include_receipt_policies ?? false;
        const filtered = includeReceipt
          ? all
          : all.filter((p) => p.mode !== "receipt");
        const pageSize = params.page_size ?? 50;
        const policies = filtered.slice(0, pageSize);
        return toolResult({ policies, page_size: policies.length });
      }),
    );

    server.registerTool(
      "add_receptive_policy",
      {
        description:
          'Add a new receptive policy. Policies stack — multiple can be active simultaneously. Supports modes: "all", "domain_filter", or "contact".',
        inputSchema: AddReceptivePolicyInputSchema,
        outputSchema: ReceptivePolicyOutputSchema,
      },
      withToolErrorHandling(async (params: AddReceptivePolicyArgs) => {
        const policy = await this.receptivePolicyManager.addPolicy(
          auth.oid,
          params.mode,
          params.domain_filter,
          params.contacts,
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

    server.registerTool(
      "remove_receptive_policy",
      {
        description:
          "Remove a receptive policy. For time-bounded windows this closes the window early. Does not affect already-delivered invitations.",
        inputSchema: RemoveReceptivePolicyInputSchema,
        outputSchema: RemoveReceptivePolicyOutputSchema,
      },
      withToolErrorHandling(async (params: RemoveReceptivePolicyArgs) => {
        await this.receptivePolicyManager.removePolicy(
          auth.oid,
          params.policy_id,
        );
        return toolResult({ policy_id: params.policy_id, deleted: true });
      }),
    );
  }
}
