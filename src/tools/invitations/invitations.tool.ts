import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthInfo } from "../../context.ts";
import type {
  AccountManager,
  DomainIdentityManager,
  InvitationManager,
} from "../../managers/mod.ts";
import { toolResult, withToolErrorHandling } from "../tool-result.ts";

const ClaimValueSchema = z.union([
  z.string().max(512),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.union([z.string().max(512), z.number(), z.boolean(), z.null()])).max(20),
]);

const ClaimMapSchema = z.record(z.string().max(64), ClaimValueSchema)
  .refine((v) => Object.keys(v).length <= 20, {
    message: "claim namespace must not exceed 20 keys",
  });

const InvitationClaimsSchema = z.object({
  immutable: ClaimMapSchema,
  user: ClaimMapSchema.optional(),
  admin: ClaimMapSchema.optional(),
  custom: ClaimMapSchema.optional(),
}).describe("Optional contextual claims attached by the sender");

const InvitationOutputSchema = {
  invitation_id: z.string().describe("Unique invitation identifier"),
  receiver_oid: z.uuid().describe("OID of the receiving user on this server"),
  sender_domain: z.string().describe("Domain of the invitation sender"),
  status: z.enum(["pending", "accepted", "rejected", "cancelled", "expired"]).describe(
    "Current lifecycle state",
  ),
  proposed_terms: z.record(z.string(), z.unknown()).describe("Proposed receipt terms"),
  claims: InvitationClaimsSchema.optional().describe("Contextual claims attached by the sender"),
  expires_at: z.iso.datetime().optional().describe("ISO 8601 timestamp when invitation expires, absent means indefinite"),
  created_at: z.iso.datetime().describe("ISO 8601 timestamp of creation"),
  accepted_at: z.iso.datetime().optional().describe("ISO 8601 timestamp of acceptance"),
};

const ListInvitationsInputSchema = {
  status: z.enum(["pending", "accepted", "rejected", "cancelled", "expired"]).optional().describe(
    "Filter by invitation status",
  ),
  sender_domain: z.string().optional().describe("Filter by sender domain"),
  page_size: z.number().int().min(1).max(100).optional().describe(
    "Maximum number of results to return (default 50)",
  ),
};

const ListInvitationsOutputSchema = {
  invitations: z.array(z.object(InvitationOutputSchema)).describe("List of invitations"),
  page_size: z.number().int().describe("Number of results returned"),
};

const ReviewInvitationInputSchema = {
  invitation_id: z.string().describe("Invitation ID to review"),
};

const AcceptInvitationInputSchema = {
  invitation_id: z.string().describe("Invitation ID to accept"),
  negotiated_terms: z.record(z.string(), z.unknown()).optional().describe(
    "Optional narrower terms to accept instead of proposed terms",
  ),
};

const RejectInvitationInputSchema = {
  invitation_id: z.string().describe("Invitation ID to reject"),
};

const SendInvitationInputSchema = {
  receiver_domain: z.string().describe("RPP domain of the receiver's server"),
  receptive_policy_id: z.uuid().describe(
    "Policy ID obtained from the receiver (e.g. via QR code). Identifies both the receiver and confirms they are receptive.",
  ),
  proposed_terms: z.record(z.string(), z.unknown()).describe("Receipt terms proposed to receiver"),
  include_user_claims: z.array(z.string()).optional().describe(
    "Keys of user-verified claims (from the sender's verified profile) to attach to the invitation.",
  ),
  include_admin_claims: z.array(z.string()).optional().describe(
    "Keys of admin-verified claims (asserted by this server's admin) to attach to the invitation.",
  ),
  custom_claims: ClaimMapSchema.optional().describe(
    "Unverified free-form claims provided by the sender. Values must be strings (≤512 chars), numbers, booleans, null, or flat arrays of those. Maximum 20 keys.",
  ),
  expires_at: z.iso.datetime().optional().describe("ISO 8601 timestamp when invitation expires; absent means indefinite"),
};

const SendInvitationOutputSchema = {
  invitation_id: z.string().describe("Created invitation ID"),
  created_at: z.iso.datetime().describe("ISO 8601 timestamp of creation"),
};

type ListInvitationsArgs = z.infer<z.ZodObject<typeof ListInvitationsInputSchema>>;
type ReviewInvitationArgs = z.infer<z.ZodObject<typeof ReviewInvitationInputSchema>>;
type AcceptInvitationArgs = z.infer<z.ZodObject<typeof AcceptInvitationInputSchema>>;
type RejectInvitationArgs = z.infer<z.ZodObject<typeof RejectInvitationInputSchema>>;
type SendInvitationArgs = z.infer<z.ZodObject<typeof SendInvitationInputSchema>>;

type InvitationClaims = {
  immutable?: Record<string, string>;
  user?: Record<string, string>;
  admin?: Record<string, string>;
  custom?: Record<string, unknown>;
};

export class InvitationTool {
  constructor(
    private readonly invitationManager: InvitationManager,
    private readonly accountManager: AccountManager,
    private readonly domainIdentityManager: DomainIdentityManager,
  ) {}

  /**
   * Resolves which claims to attach to an outgoing invitation envelope by
   * looking up the caller's stored verified metadata and filtering it to only
   * the keys the caller explicitly requested. Custom claims are passed through
   * as-is. The sender's domain_id is always injected into the immutable
   * namespace regardless of what the caller requests.
   */
  private async resolveClaims(
    oid: string,
    includeUserClaims: string[] | undefined,
    includeAdminClaims: string[] | undefined,
    customClaims: Record<string, unknown> | undefined,
  ): Promise<InvitationClaims> {
    const metadata = await this.accountManager.getUserVerifiedMetadata(oid);

    const user: Record<string, string> = {};
    if (includeUserClaims?.length && metadata?.user_verified_fields) {
      for (const key of includeUserClaims) {
        if (key in metadata.user_verified_fields) {
          user[key] = metadata.user_verified_fields[key];
        }
      }
    }

    const admin: Record<string, string> = {};
    if (includeAdminClaims?.length && metadata?.admin_verified_fields) {
      for (const key of includeAdminClaims) {
        if (key in metadata.admin_verified_fields) {
          admin[key] = metadata.admin_verified_fields[key];
        }
      }
    }

    // Always inject domain_id from immutable_fields into the immutable namespace.
    const immutable: Record<string, string> = {};
    const domainId = metadata?.immutable_fields?.["domain_id"];
    if (domainId) {
      immutable["domain_id"] = domainId;
    }

    return {
      immutable,
      ...(Object.keys(user).length && { user }),
      ...(Object.keys(admin).length && { admin }),
      ...(customClaims && { custom: customClaims }),
    };
  }

  register(server: McpServer, auth: AuthInfo): void {
    server.registerTool(
      "list_invitations",
      {
        description:
          "List invitations across lifecycle states (pending, accepted, rejected, expired). Supports filtering by sender domain and status.",
        inputSchema: ListInvitationsInputSchema,
        outputSchema: ListInvitationsOutputSchema,
      },
      withToolErrorHandling(async (params: ListInvitationsArgs) => {
        let invitations = await this.invitationManager.listByReceiver(auth.oid);

        if (params.status) {
          invitations = invitations.filter((inv) => inv.status === params.status);
        }

        if (params.sender_domain) {
          invitations = invitations.filter((inv) => inv.sender_domain === params.sender_domain);
        }

        const pageSize = params.page_size ?? 50;
        const paginated = invitations.slice(0, pageSize);

        return toolResult({
          invitations: paginated.map((inv) => ({ ...inv })),
          page_size: paginated.length,
        });
      }),
    );

    server.registerTool(
      "review_invitation",
      {
        description:
          "Get detailed information about a specific invitation for review before accepting or rejecting.",
        inputSchema: ReviewInvitationInputSchema,
        outputSchema: InvitationOutputSchema,
      },
      withToolErrorHandling(async (params: ReviewInvitationArgs) => {
        const invitation = await this.invitationManager.getInvitation(params.invitation_id);
        if (!invitation) {
          throw new Error(`Invitation ${params.invitation_id} not found`);
        }
        return toolResult(invitation);
      }),
    );

    server.registerTool(
      "accept_invitation",
      {
        description:
          "Accept an invitation and optionally negotiate narrower terms. Issues a receipt enabling future communication.",
        inputSchema: AcceptInvitationInputSchema,
        outputSchema: InvitationOutputSchema,
      },
      withToolErrorHandling(async (params: AcceptInvitationArgs) => {
        const invitation = await this.invitationManager.accept(
          params.invitation_id,
          params.negotiated_terms,
        );
        return toolResult(invitation);
      }),
    );

    server.registerTool(
      "reject_invitation",
      {
        description:
          "Reject an invitation. The sender may send a new invitation later.",
        inputSchema: RejectInvitationInputSchema,
        outputSchema: InvitationOutputSchema,
      },
      withToolErrorHandling(async (params: RejectInvitationArgs) => {
        const invitation = await this.invitationManager.reject(params.invitation_id);
        return toolResult(invitation);
      }),
    );

    server.registerTool(
      "send_invitation",
      {
        description:
          "Send an invitation to a receiver offering proposed receipt terms. Creates a public invitation or direct invitation.",
        inputSchema: SendInvitationInputSchema,
        outputSchema: SendInvitationOutputSchema,
      },
      withToolErrorHandling(async (params: SendInvitationArgs) => {
        const identity = await this.domainIdentityManager.getDomainIdentity();
        const senderDomain = identity.domain;

        const claims = await this.resolveClaims(
          auth.oid,
          params.include_user_claims,
          params.include_admin_claims,
          params.custom_claims,
        );

        const messageId = crypto.randomUUID();
        const createdAt = new Date().toISOString();
        const expiresAt = params.expires_at;

        const envelope = {
          message_id: messageId,
          sender_domain: senderDomain,
          category: "invitation" as const,
          sent_at: createdAt,
          invitation: {
            receptive_policy_id: params.receptive_policy_id,
            proposed_terms: params.proposed_terms,
            claims,
            ...(expiresAt !== undefined && { expires_at: expiresAt }),
          },
        };

        // Deliver the invitation envelope to the receiver's submit endpoint.
        // Policy validation happens on the receiver's server.
        const scheme = params.receiver_domain.startsWith("localhost")
          ? "http"
          : "https";
        const url = `${scheme}://${params.receiver_domain}/rpp/v1/messages`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(envelope),
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(
            `Failed to deliver invitation to ${params.receiver_domain}: ${response.status} ${text}`,
          );
        }
        await response.body?.cancel();

        return toolResult({
          invitation_id: messageId,
          created_at: createdAt,
        });
      }),
    );
  }
}
