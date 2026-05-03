import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthInfo } from "../../context.ts";
import type {
  AccountManager,
  DomainIdentityManager,
  InvitationManager,
} from "../../managers/mod.ts";
import { CONTENT_RATINGS, MESSAGE_CATEGORIES } from "../../models/mod.ts";
import type { InvitationClaims, ReceiptTerms } from "../../models/mod.ts";
import type { ConfigService } from "../../services/config/config.service.ts";
import { toolResult, withToolErrorHandling } from "../tool-result.ts";
import { inputDate, outputDate } from "../date-schema.ts";
import { deliverReceiptCallback } from "./callback-delivery.ts";
import {
  InvitationNotCancellableError,
} from "../../managers/invitation/invitation.error.ts";

const CategorySchema = z.enum(MESSAGE_CATEGORIES);
const ContentRatingSchema = z.enum(CONTENT_RATINGS);

const ClaimValueSchema = z.union([
  z.string().max(512),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.union([z.string().max(512), z.number(), z.boolean(), z.null()]))
    .max(20),
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
  status: z.enum([
    "pending",
    "accepted",
    "rejected",
    "cancelled",
    "expired",
    "undelivered",
  ])
    .describe(
      "Current lifecycle state",
    ),
  proposed_terms: z.record(z.string(), z.unknown()).describe(
    "Proposed receipt terms",
  ),
  claims: InvitationClaimsSchema.optional().describe(
    "Contextual claims attached by the sender",
  ),
  expires_at: outputDate().optional().describe(
    "ISO 8601 timestamp when invitation expires, absent means indefinite",
  ),
  created_at: outputDate().describe("ISO 8601 timestamp of creation"),
  accepted_at: outputDate().optional().describe(
    "ISO 8601 timestamp of acceptance",
  ),
  receipt: z.object({
    id: z.string().describe("Issued receipt ID"),
    category: z.string().describe("Permitted message category"),
    max_content_rating: z.string().optional().describe(
      "Maximum content rating",
    ),
    usage_policy: z.string().optional().describe("Usage policy"),
    issued_at: outputDate().describe("ISO 8601 timestamp of issuance"),
  }).optional().describe(
    "Receipt summary recorded after acceptance (Section 9.7). Visible to the original sender on review_invitation.",
  ),
  acceptor_display_name: z.string().optional().describe(
    "Optional voluntary display name supplied by the acceptor",
  ),
  decision_reason: z.string().optional().describe(
    "Optional human-readable reason supplied by the acceptor",
  ),
};

const ListInvitationsInputSchema = {
  status: z.enum([
    "pending",
    "accepted",
    "rejected",
    "cancelled",
    "expired",
    "undelivered",
  ])
    .optional().describe(
      "Filter by invitation status",
    ),
  sender_domain: z.string().optional().describe("Filter by sender domain"),
  page_size: z.number().int().min(1).max(100).optional().describe(
    "Maximum number of results to return (default 50)",
  ),
};

const AcceptInvitationOutputSchema = {
  ...InvitationOutputSchema,
  receipt: z.object({
    id: z.uuid().describe("Receipt ID to present in x-rpp-receipt-id header"),
    secret: z.string().regex(/^[0-9a-f]{64}$/).describe(
      "64-char hex-encoded 32-byte HMAC-SHA-256 secret for signing submit requests",
    ),
    category: CategorySchema.describe("Permitted message category"),
    max_content_rating: ContentRatingSchema.describe("Maximum content rating"),
    usage_policy: z.enum(["one-time", "multiple-time", "any-time"]).describe(
      "Usage policy",
    ),
    issued_at: outputDate().describe("ISO 8601 timestamp of issuance"),
  }).describe("Issued receipt credentials — share with the sender"),
};

const ListInvitationsOutputSchema = {
  invitations: z.array(z.object(InvitationOutputSchema)).describe(
    "List of invitations",
  ),
  page_size: z.number().int().describe("Number of results returned"),
};

const ReviewInvitationInputSchema = {
  invitation_id: z.string().describe("Invitation ID to review"),
};

const AcceptInvitationInputSchema = {
  invitation_id: z.string().describe("Invitation ID to accept"),
  negotiated_terms: z.object({
    category: CategorySchema,
    max_content_rating: ContentRatingSchema.optional(),
    usage_policy: z.enum(["one-time", "multiple-time", "any-time"]).optional(),
  }).passthrough().optional().describe(
    "Optional narrower terms to accept instead of proposed terms",
  ),
  reason: z.string().optional().describe(
    "Optional human-readable note delivered to the inviting domain",
  ),
};

const RejectInvitationInputSchema = {
  invitation_id: z.string().describe("Invitation ID to reject"),
  reason: z.string().optional().describe(
    "Optional human-readable note delivered to the inviting domain",
  ),
};

const SendInvitationInputSchema = {
  receiver_domain: z.string().describe("RPP domain of the receiver's server"),
  receptive_policy_id: z.uuid().optional().describe(
    "Policy ID UUID obtained from the receiver. Identifies the receiver and confirms they are receptive. Provide one of: receptive_policy_id, shortcode, or receipt_id.",
  ),
  shortcode: z.string().optional().describe(
    "8-character shortcode shared by the receiver (e.g. 'abc12xyz'). Use this together with receiver_domain as a human-friendly alternative to receptive_policy_id. The receiver will resolve it to the underlying policy. Provide one of: receptive_policy_id, shortcode, or receipt_id.",
  ),
  receipt_id: z.uuid().optional().describe(
    "Receipt ID from a prior accepted invitation. Allows re-inviting an existing contact without a new receptive window.",
  ),
  proposed_terms: z.record(z.string(), z.unknown()).describe(
    "Receipt terms proposed to receiver",
  ),
  include_user_claims: z.array(z.string()).optional().describe(
    "Keys of user-verified claims (from the sender's verified profile) to attach to the invitation.",
  ),
  include_admin_claims: z.array(z.string()).optional().describe(
    "Keys of admin-verified claims (asserted by this server's admin) to attach to the invitation.",
  ),
  custom_claims: ClaimMapSchema.optional().describe(
    "Unverified free-form claims provided by the sender. Values must be strings (≤512 chars), numbers, booleans, null, or flat arrays of those. Maximum 20 keys.",
  ),
  expires_at: inputDate().optional().describe(
    "ISO 8601 timestamp when invitation expires; absent means indefinite",
  ),
};

const SendInvitationOutputSchema = {
  invitation_id: z.string().describe("Created invitation ID"),
  created_at: outputDate().describe("ISO 8601 timestamp of creation"),
};

const CancelInvitationInputSchema = {
  invitation_id: z.string().describe(
    "ID of the invitation to cancel. Must be an invitation you sent.",
  ),
};

type ListInvitationsArgs = z.infer<
  z.ZodObject<typeof ListInvitationsInputSchema>
>;
type ReviewInvitationArgs = z.infer<
  z.ZodObject<typeof ReviewInvitationInputSchema>
>;
type AcceptInvitationArgs = z.infer<
  z.ZodObject<typeof AcceptInvitationInputSchema>
>;
type RejectInvitationArgs = z.infer<
  z.ZodObject<typeof RejectInvitationInputSchema>
>;
type SendInvitationArgs = z.infer<
  z.ZodObject<typeof SendInvitationInputSchema>
>;
type CancelInvitationArgs = z.infer<
  z.ZodObject<typeof CancelInvitationInputSchema>
>;

export class InvitationTool {
  constructor(
    private readonly invitationManager: InvitationManager,
    private readonly accountManager: AccountManager,
    private readonly domainIdentityManager: DomainIdentityManager,
    private readonly config: ConfigService,
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
    } as InvitationClaims;
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
          invitations = invitations.filter((inv) =>
            inv.status === params.status
          );
        }

        if (params.sender_domain) {
          invitations = invitations.filter((inv) =>
            inv.sender_domain === params.sender_domain
          );
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
        const invitation = await this.invitationManager.getInvitation(
          params.invitation_id,
        );
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
        outputSchema: AcceptInvitationOutputSchema,
      },
      withToolErrorHandling(async (params: AcceptInvitationArgs) => {
        const identity = await this.domainIdentityManager.getDomainIdentity();
        const localDomain = identity.domain;

        const { invitation, receipt } = await this.invitationManager.accept(
          params.invitation_id,
          params.negotiated_terms,
          params.reason,
        );

        if (
          invitation.delivery &&
          invitation.delivery.domain !== localDomain
        ) {
          const result = await deliverReceiptCallback(
            invitation.delivery,
            invitation.invitation_id,
            "accepted",
            receipt,
            params.reason,
          );
          if (result.permanentFailure) {
            await this.invitationManager.markUndelivered(
              invitation.invitation_id,
            );
          }
        }

        return toolResult({
          ...invitation,
          receipt: {
            id: receipt.id,
            secret: receipt.secret,
            category: receipt.category,
            max_content_rating: receipt.max_content_rating,
            usage_policy: receipt.usage_policy,
            issued_at: receipt.issued_at,
          },
        });
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
        const rejectIdentity = await this.domainIdentityManager
          .getDomainIdentity();
        const rejectLocalDomain = rejectIdentity.domain;

        const invitation = await this.invitationManager.reject(
          params.invitation_id,
          params.reason,
        );

        if (
          invitation.delivery &&
          invitation.delivery.domain !== rejectLocalDomain
        ) {
          const result = await deliverReceiptCallback(
            invitation.delivery,
            invitation.invitation_id,
            "rejected",
            undefined,
            params.reason,
          );
          if (result.permanentFailure) {
            await this.invitationManager.markUndelivered(
              invitation.invitation_id,
            );
          }
        }

        return toolResult(invitation);
      }),
    );

    server.registerTool(
      "send_invitation",
      {
        description:
          "Send an invitation to a receiver offering proposed receipt terms. Creates a public invitation or direct invitation. " +
          "To address the receiver use one of: receptive_policy_id (UUID), shortcode + receiver_domain (when the receiver shared a shortcode from open_receptive_window), or receipt_id. " +
          "IMPORTANT: Before calling this tool, ask the user which verified claims they would like to include with the invitation. " +
          "Use get_user_verified_metadata to retrieve the available user-verified claims and get_domain_identity to retrieve admin-verified claims, " +
          "then present the available claim keys to the user and ask which ones to include via include_user_claims and include_admin_claims. " +
          "Do not silently omit or include claims without the user's explicit direction.",
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
        const invitationId = crypto.randomUUID();
        const deliveryToken = crypto.randomUUID();
        const createdAt = new Date();
        const expiresAt = params.expires_at;

        const envelope = {
          message_id: messageId,
          sender_domain: senderDomain,
          category: "invitation" as const,
          sent_at: createdAt,
          invitation: {
            invitation_id: invitationId,
            ...(params.receptive_policy_id !== undefined &&
              { receptive_policy_id: params.receptive_policy_id }),
            ...(params.shortcode !== undefined &&
              { shortcode: params.shortcode }),
            ...(params.receipt_id !== undefined &&
              { receipt_id: params.receipt_id }),
            proposed_terms: params.proposed_terms,
            claims,
            ...(expiresAt !== undefined && { expires_at: expiresAt }),
            delivery: {
              domain: senderDomain,
              token: deliveryToken,
            },
          },
        };

        // Deliver the invitation envelope to the receiver's submit endpoint.
        // Per spec Section 4.1: localhost uses http, all other domains use https.
        if (params.receiver_domain === senderDomain) {
          // Same-domain: bypass HTTP to avoid Deno Deploy self-loop detection
          // (508). Call the manager directly — no network round-trip needed.
          await this.invitationManager.deliverLocally(
            invitationId,
            messageId,
            senderDomain,
            claims as InvitationClaims,
            params.receptive_policy_id,
            params.shortcode,
            params.receipt_id,
            params.proposed_terms as ReceiptTerms,
            expiresAt,
            { domain: senderDomain, token: deliveryToken },
          );
        } else {
          const receiverIsLocalhost = params.receiver_domain === "localhost" ||
            params.receiver_domain.startsWith("localhost:");
          const scheme = receiverIsLocalhost ? "http" : "https";
          const url = `${scheme}://${params.receiver_domain}/rpp/v1/envelopes`;
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
        }

        return toolResult({
          invitation_id: invitationId,
          created_at: createdAt,
        });
      }),
    );

    server.registerTool(
      "cancel_invitation",
      {
        description:
          "Cancel a direct invitation you sent, transitioning it to 'cancelled'. " +
          "Valid from 'pending' or 'accepted' state (synonymous with rescinding/withdrawing). " +
          "All receipts derived from the invitation are immediately revoked. " +
          "Only the original sender may cancel; attempts by others return not-found.",
        inputSchema: CancelInvitationInputSchema,
        outputSchema: InvitationOutputSchema,
      },
      withToolErrorHandling(async (params: CancelInvitationArgs) => {
        const metadata = await this.accountManager.getUserVerifiedMetadata(
          auth.oid,
        );
        const senderDomainId = metadata?.immutable_fields?.["domain_id"];
        if (typeof senderDomainId !== "string") {
          throw new InvitationNotCancellableError(
            params.invitation_id,
            "unknown",
          );
        }
        const invitation = await this.invitationManager.cancel(
          params.invitation_id,
          senderDomainId,
        );
        return toolResult(invitation);
      }),
    );
  }
}
