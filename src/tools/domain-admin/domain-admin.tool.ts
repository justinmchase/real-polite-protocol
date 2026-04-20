import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthInfo } from "../../context.ts";
import type { AccountManager } from "../../managers/mod.ts";
import type { DomainIdentityManager } from "../../managers/mod.ts";
import { toolResult } from "../tool-result.ts";

const DomainIdentityOutputSchema = {
  domain: z.string().describe("The domain name"),
  display_name: z.string().describe("Human-readable display name"),
  domain_type: z.string().optional().describe("Type of domain"),
  parent_domain: z.string().optional().describe("Parent domain if subdomain"),
  categories_offered: z.array(z.string()).optional().describe(
    "Content categories offered",
  ),
  rpp_since: z.string().datetime().optional().describe(
    "ISO 8601 date when RPP support began",
  ),
  contact_policy_url: z.string().url().optional().describe(
    "URL to the domain's contact policy",
  ),
};

const UpdateDomainIdentityInputSchema = {
  display_name: z.string().optional().describe(
    "Human-readable display name for the domain",
  ),
  domain_type: z.string().optional().describe(
    "Type of domain (e.g. 'podcast', 'newsletter')",
  ),
  parent_domain: z.string().optional().describe(
    "Parent domain if this is a subdomain",
  ),
  categories_offered: z.array(z.string()).optional().describe(
    "Content categories offered",
  ),
  rpp_since: z.string().optional().describe(
    "ISO 8601 date when RPP support began",
  ),
  contact_policy_url: z.string().optional().describe(
    "URL to the domain's contact policy",
  ),
};

type UpdateDomainIdentityArgs = z.infer<
  z.ZodObject<typeof UpdateDomainIdentityInputSchema>
>;

export class DomainAdminTool {
  constructor(
    private readonly accountManager: AccountManager,
    private readonly domainIdentityManager: DomainIdentityManager,
  ) {}

  register(server: McpServer, auth: AuthInfo): void {
    if (!this.accountManager.isDomainAdmin(auth.roles)) {
      return;
    }

    server.registerTool(
      "get_domain_identity",
      {
        description:
          "Retrieve the current domain identity as published by the server.",
        outputSchema: DomainIdentityOutputSchema,
      },
      async () => {
        const identity = await this.domainIdentityManager.getDomainIdentity();
        return toolResult(identity);
      },
    );

    server.registerTool(
      "update_domain_identity",
      {
        description: "Update mutable domain identity fields.",
        inputSchema: UpdateDomainIdentityInputSchema,
        outputSchema: DomainIdentityOutputSchema,
      },
      async (params: UpdateDomainIdentityArgs) => {
        const identity = await this.domainIdentityManager.updateDomainIdentity(
          params,
        );
        return toolResult(identity);
      },
    );
  }
}
