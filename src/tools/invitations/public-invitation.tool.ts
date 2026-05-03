import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthInfo } from "../../context.ts";
import { inputDate, outputDate } from "../date-schema.ts";
import { toolResult, withToolErrorHandling } from "../tool-result.ts";
import type { PublicInvitationManager } from "../../managers/mod.ts";
import type { DomainIdentityManager } from "../../managers/mod.ts";
import type { ConfigService } from "../../services/config/config.service.ts";
import { CONTENT_RATINGS, MESSAGE_CATEGORIES } from "../../models/mod.ts";

const CategorySchema = z.enum(MESSAGE_CATEGORIES);
const ContentRatingSchema = z.enum(CONTENT_RATINGS);

const ProposedTermsSchema = z.object({
  category: CategorySchema,
  max_content_rating: ContentRatingSchema.optional(),
  usage_policy: z.enum(["one-time", "multiple-time", "any-time"]).optional(),
}).passthrough();

const DomainFilterRuleSchema = z.object({
  action: z.enum(["allow", "block"]),
  pattern: z.string(),
});

const DomainFilterSchema = z.object({
  rules: z.array(DomainFilterRuleSchema),
});

const PublicInvitationOutputSchema = {
  invitation_id: z.string(),
  oid: z.string(),
  domain: z.string(),
  display_name: z.string().optional(),
  description: z.string().optional(),
  proposed_terms: z.record(z.string(), z.unknown()),
  domain_filter: DomainFilterSchema.optional(),
  max_acceptances: z.number().int().positive().optional(),
  acceptance_count: z.number().int().min(0),
  expires_at: outputDate().optional(),
  created_at: outputDate(),
  cancelled_at: outputDate().optional(),
  status: z.enum(["active", "cancelled", "expired"]),
};

const CreatePublicInvitationInputSchema = {
  proposed_terms: ProposedTermsSchema.describe(
    "Receipt terms offered to acceptors",
  ),
  display_name: z.string().optional().describe(
    "Optional Unicode display name for human presentation",
  ),
  description: z.string().optional().describe(
    "Optional freeform text describing the invitation's purpose",
  ),
  domain_filter: DomainFilterSchema.optional().describe(
    "Optional domain filter restricting who may accept",
  ),
  max_acceptances: z.number().int().positive().optional().describe(
    "Maximum number of times this invitation can be accepted; if omitted, unlimited",
  ),
  expires_at: inputDate().optional().describe(
    "ISO 8601 timestamp after which the invitation is no longer valid",
  ),
};

const CreatePublicInvitationOutputSchema = {
  invitation_id: z.string(),
  created_at: outputDate(),
};

const ListPublicInvitationsInputSchema = {
  status: z.enum(["active", "cancelled", "expired"]).optional().describe(
    "Filter by status",
  ),
  page_size: z.number().int().min(1).max(100).optional().describe(
    "Maximum number of results to return (default 50)",
  ),
};

const ListPublicInvitationsOutputSchema = {
  invitations: z.array(z.object(PublicInvitationOutputSchema)),
  page_size: z.number().int(),
};

const FetchPublicInvitationInputSchema = {
  domain: z.string().describe("RPP domain hosting the invitation"),
  invitation_id: z.string().describe("Invitation ID to fetch"),
};

const UpdatePublicInvitationInputSchema = {
  invitation_id: z.string().describe("ID of the public invitation to update"),
  display_name: z.string().nullable().optional().describe(
    "New display name; pass null to clear",
  ),
  description: z.string().nullable().optional().describe(
    "New description; pass null to clear",
  ),
  domain_filter: DomainFilterSchema.nullable().optional().describe(
    "New domain filter; pass null to remove",
  ),
  proposed_terms: z.unknown().optional().describe(
    "NOT ALLOWED — proposed_terms cannot be updated after creation",
  ),
};

const AcceptPublicInvitationInputSchema = {
  domain: z.string().describe(
    "RPP domain hosting the public invitation",
  ),
  invitation_id: z.string().describe("Invitation ID to accept"),
  negotiated_terms: z.object({
    category: CategorySchema,
    max_content_rating: ContentRatingSchema.optional(),
    usage_policy: z.enum(["one-time", "multiple-time", "any-time"]).optional(),
  }).passthrough().optional().describe(
    "Optional narrower terms to accept instead of proposed terms",
  ),
  display_name: z.string().optional().describe(
    "Optional voluntary display name to include with acceptance",
  ),
};

const AcceptPublicInvitationOutputSchema = {
  invitation_id: z.string(),
  receipt_id: z.string(),
  issued_at: outputDate(),
};

type CreatePublicInvitationArgs = z.infer<
  z.ZodObject<typeof CreatePublicInvitationInputSchema>
>;
type ListPublicInvitationsArgs = z.infer<
  z.ZodObject<typeof ListPublicInvitationsInputSchema>
>;
type FetchPublicInvitationArgs = z.infer<
  z.ZodObject<typeof FetchPublicInvitationInputSchema>
>;
type UpdatePublicInvitationArgs = z.infer<
  z.ZodObject<typeof UpdatePublicInvitationInputSchema>
>;
type AcceptPublicInvitationArgs = z.infer<
  z.ZodObject<typeof AcceptPublicInvitationInputSchema>
>;

export class PublicInvitationTool {
  constructor(
    private readonly publicInvitationManager: PublicInvitationManager,
    private readonly domainIdentityManager: DomainIdentityManager,
    private readonly config: ConfigService,
  ) {}

  register(server: McpServer, auth: AuthInfo): void {
    server.registerTool(
      "create_public_invitation",
      {
        description:
          "Create a public invitation — a standing offer that can be discovered and accepted by anyone who obtains the invitation ID (Section 9.4). " +
          "Optionally include a display name, description, domain filter, acceptance limit, and expiration.",
        inputSchema: CreatePublicInvitationInputSchema,
        outputSchema: CreatePublicInvitationOutputSchema,
      },
      withToolErrorHandling(async (params: CreatePublicInvitationArgs) => {
        const identity = await this.domainIdentityManager.getDomainIdentity();
        const invitation = await this.publicInvitationManager.create(
          auth.oid,
          identity.domain,
          params.proposed_terms,
          {
            displayName: params.display_name,
            description: params.description,
            domainFilter: params.domain_filter,
            maxAcceptances: params.max_acceptances,
            expiresAt: params.expires_at,
          },
        );
        return toolResult({
          invitation_id: invitation.invitation_id,
          created_at: invitation.created_at,
        });
      }),
    );

    server.registerTool(
      "list_public_invitations",
      {
        description:
          "List the listener's own public invitations. Supports filtering by status (active, cancelled, expired).",
        inputSchema: ListPublicInvitationsInputSchema,
        outputSchema: ListPublicInvitationsOutputSchema,
      },
      withToolErrorHandling(async (params: ListPublicInvitationsArgs) => {
        let invitations = await this.publicInvitationManager.list(auth.oid);

        if (params.status) {
          invitations = invitations.filter((inv) =>
            inv.status === params.status
          );
        }

        const pageSize = params.page_size ?? 50;
        const paginated = invitations.slice(0, pageSize);

        return toolResult({
          invitations: paginated,
          page_size: paginated.length,
        });
      }),
    );

    server.registerTool(
      "fetch_public_invitation",
      {
        description:
          "Fetch a public invitation by domain and invitation ID. The invitation is retrieved from the hosting domain's unauthenticated endpoint. " +
          "Returns the full invitation object including any verification attestation.",
        inputSchema: FetchPublicInvitationInputSchema,
        outputSchema: PublicInvitationOutputSchema,
      },
      withToolErrorHandling(async (params: FetchPublicInvitationArgs) => {
        const localDomain = this.config.domain;
        const isLocal = params.domain === localDomain ||
          params.domain.startsWith("localhost");

        if (isLocal) {
          // Serve directly from local store.
          const invitation = await this.publicInvitationManager.get(
            params.invitation_id,
          );
          if (!invitation) {
            throw new Error(
              `Public invitation ${params.invitation_id} not found`,
            );
          }
          return toolResult(invitation);
        }

        // Fetch from remote domain (unauthenticated).
        const isLocalhost = params.domain === "localhost" ||
          params.domain.startsWith("localhost:");
        const scheme = isLocalhost ? "http" : "https";
        const url =
          `${scheme}://${params.domain}/rpp/v1/invitations/${params.invitation_id}`;
        const response = await fetch(url);
        if (!response.ok) {
          const text = await response.text();
          throw new Error(
            `Failed to fetch public invitation from ${params.domain}: ${response.status} ${text}`,
          );
        }
        const data = await response.json();
        return toolResult(data);
      }),
    );

    server.registerTool(
      "update_public_invitation",
      {
        description:
          "Update mutable fields on a public invitation you own (display_name, description, domain_filter). " +
          "Changes apply only to future acceptances; existing receipts from prior acceptances are unaffected. " +
          "proposed_terms cannot be changed — create a new invitation to offer different terms.",
        inputSchema: UpdatePublicInvitationInputSchema,
        outputSchema: PublicInvitationOutputSchema,
      },
      withToolErrorHandling(async (params: UpdatePublicInvitationArgs) => {
        const updated = await this.publicInvitationManager.update(
          params.invitation_id,
          auth.oid,
          {
            displayName: params.display_name,
            description: params.description,
            domainFilter: params.domain_filter ?? undefined,
            proposedTerms: params.proposed_terms,
          },
        );
        return toolResult(updated);
      }),
    );

    server.registerTool(
      "accept_public_invitation",
      {
        description:
          "Accept a public invitation, optionally with narrower negotiated terms. " +
          "The server validates any domain_filter and max_acceptances limit, then issues a receipt. " +
          "Provide the hosting domain and invitation_id (obtained via fetch_public_invitation or out-of-band sharing).",
        inputSchema: AcceptPublicInvitationInputSchema,
        outputSchema: AcceptPublicInvitationOutputSchema,
      },
      withToolErrorHandling(async (params: AcceptPublicInvitationArgs) => {
        const localDomain = this.config.domain;
        const isLocal = params.domain === localDomain ||
          params.domain.startsWith("localhost");

        if (isLocal) {
          const acceptorDomain = localDomain;
          const { invitation, receipt } = await this.publicInvitationManager
            .accept(
              params.invitation_id,
              auth.oid,
              acceptorDomain,
              params.negotiated_terms,
            );
          return toolResult({
            invitation_id: invitation.invitation_id,
            receipt_id: receipt.id,
            issued_at: receipt.issued_at,
          });
        }

        // Cross-domain: POST to remote server's acceptance endpoint.
        const isLocalhost = params.domain === "localhost" ||
          params.domain.startsWith("localhost:");
        const scheme = isLocalhost ? "http" : "https";
        const url =
          `${scheme}://${params.domain}/rpp/v1/invitations/${params.invitation_id}/accept`;

        const identity = await this.domainIdentityManager.getDomainIdentity();
        const response = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            acceptor_oid: auth.oid,
            acceptor_domain: identity.domain,
            ...(params.display_name !== undefined && {
              display_name: params.display_name,
            }),
            ...(params.negotiated_terms !== undefined && {
              negotiated_terms: params.negotiated_terms,
            }),
          }),
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(
            `Failed to accept public invitation on ${params.domain}: ${response.status} ${text}`,
          );
        }

        const data = await response.json();
        return toolResult(data);
      }),
    );
  }
}
