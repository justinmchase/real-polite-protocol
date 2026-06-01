import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthInfo } from "../../context.ts";
import type { ReceptivePolicyManager } from "../../managers/mod.ts";
import type { ConfigService } from "../../services/config/config.service.ts";
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

const ContactPolicyEntrySchema = z.object({
  domain: z.string().describe("Issuing hostname"),
  domain_id: z.string().describe("domain_id scoped to domain"),
});

const ReceptivePolicyOutputSchema = {
  policy_id: z.string().describe("Unique identifier for this policy"),
  oid: z.string().describe("Owner OID"),
  mode: z.enum(["all", "domain_filter", "contact", "closed"]).describe(
    'Receptive mode: "all", "domain_filter", "contact", or "closed"',
  ),
  domain_filter: DomainFilterSchema.optional().describe(
    "Domain filter rules applied when mode is domain_filter",
  ),
  contacts: z.array(ContactPolicyEntrySchema).optional().describe(
    "(domain, domain_id) pairs allowed to send invitations (mode: contact)",
  ),
  receptive_until: outputDate().optional().describe(
    "ISO 8601 expiry timestamp for time-bounded policies",
  ),
  shortcode: z.string().optional().describe(
    "Short 8-character alphanumeric code for time-bounded windows.",
  ),
  domain: z.string().optional().describe(
    "The server's RPP domain. Present on open_receptive_window responses so the caller can share it alongside the shortcode.",
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
};

const AddReceptivePolicyInputSchema = {
  mode: z.enum(["all", "domain_filter", "contact", "closed"]).describe(
    'Receptive mode: "all" accepts any sender, "domain_filter" applies rules, "contact" accepts only listed (domain, domain_id) pairs, "closed" explicitly rejects all senders',
  ),
  domain_filter: DomainFilterSchema.optional().describe(
    "Domain filter rules to apply when mode is domain_filter",
  ),
  contacts: z.array(ContactPolicyEntrySchema).optional().describe(
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
  policy_id: z.string().describe("ID of the policy to remove"),
};

const RemoveReceptivePolicyOutputSchema = {
  policy_id: z.string().describe("ID of the removed policy"),
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
    private readonly config: ConfigService,
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
          'Add a new receptive policy. Policies stack — multiple can be active simultaneously. Supports modes: "all", "domain_filter", "contact", or "closed".',
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
          "Open a time-bounded receptive window that stacks with existing policies. " +
          "Returns a shortcode (8 lowercase alphanumeric characters) tied to this window. " +
          "IMPORTANT: After calling this tool you MUST immediately display the shortcode and " +
          "the server domain to the user in a clearly copyable format. " +
          "The user needs to share BOTH values with the person who wants to send them an invitation.",
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
        return toolResult({ ...policy, domain: this.config.domain });
      }),
    );

    server.registerTool(
      "remove_receptive_policy",
      {
        description:
          "Remove a receptive policy. For time-bounded windows this closes the window early.",
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
