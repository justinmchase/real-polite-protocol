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
  oid: z.string().describe("User object identifier"),
  mode: z.enum(["all", "domain_filter", "closed"]).describe(
    'Base receptive mode: "all", "domain_filter", or "closed"',
  ),
  domain_filter: DomainFilterSchema.optional().describe(
    "Domain filter rules applied when mode is domain_filter",
  ),
  receptive_until: z.iso.datetime().optional().describe(
    "ISO 8601 timestamp after which the active time-bounded window expires",
  ),
  window_scope: z.enum(["all", "domain_filter"]).optional().describe(
    "Receptive mode applied during the time-bounded window",
  ),
  window_domain_filter: DomainFilterSchema.optional().describe(
    "Domain filter applied during the time-bounded window when window_scope is domain_filter",
  ),
  updated_at: z.iso.datetime().describe(
    "ISO 8601 timestamp of the last policy update",
  ),
};

const SetReceptivePolicyInputSchema = {
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
  window_domain_filter: DomainFilterSchema.optional().describe(
    "Domain filter to apply during the window when scope is domain_filter",
  ),
};

type SetReceptivePolicyArgs = z.infer<
  z.ZodObject<typeof SetReceptivePolicyInputSchema>
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
      "get_receptive_policy",
      {
        description:
          "Retrieve the listener's current receptive policy configuration.",
        outputSchema: ReceptivePolicyOutputSchema,
      },
      withToolErrorHandling(async () => {
        const policy = await this.receptivePolicyManager.getPolicy(auth.oid);
        return toolResult(policy);
      }),
    );

    server.registerTool(
      "set_receptive_policy",
      {
        description:
          'Update the receptive policy. Supports modes: "all" (accept from any sender), "domain_filter" (apply domain rules), or "closed" (block all invitations).',
        inputSchema: SetReceptivePolicyInputSchema,
        outputSchema: ReceptivePolicyOutputSchema,
      },
      withToolErrorHandling(async (params: SetReceptivePolicyArgs) => {
        const policy = await this.receptivePolicyManager.setPolicy(
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
          "Create a time-bounded receptive window for incoming invitations. Recommended for proximity pairing. The window expires after the specified duration and reverts to the base policy.",
        inputSchema: OpenReceptiveWindowInputSchema,
        outputSchema: ReceptivePolicyOutputSchema,
      },
      withToolErrorHandling(async (params: OpenReceptiveWindowArgs) => {
        const policy = await this.receptivePolicyManager.openWindow(
          auth.oid,
          params.duration_seconds,
          params.scope ?? "all",
          params.window_domain_filter,
        );
        return toolResult(policy);
      }),
    );
  }
}
