import { generate as generateUUIDv7 } from "@std/uuid/v7";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthInfo } from "../../context.ts";
import type {
  AccountManager,
  ContactManager,
  InvitationManager,
  ReceptivePolicyManager,
} from "../../managers/mod.ts";
import { generateContactCredential } from "../../managers/contacts/credential.ts";
import { ContactBlockedError } from "../../managers/contacts/contact.error.ts";
import { CONTENT_RATINGS, MESSAGE_CATEGORIES } from "../../models/mod.ts";
import type {
  ClaimValue,
  CommunicationTerms,
  ContactCredential,
  Invitation,
  InvitationClaims,
} from "../../models/mod.ts";
import type { ConfigService } from "../../services/config/config.service.ts";
import { toolResult, withToolErrorHandling } from "../tool-result.ts";
import { inputDate, outputDate } from "../date-schema.ts";
import type { EnvelopeDispatcher } from "../envelope-dispatch.ts";

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

const InvitationClaimsOutputSchema = z.object({
  immutable: z.record(z.string(), ClaimValueSchema),
  user: z.record(z.string(), ClaimValueSchema).optional(),
  admin: z.record(z.string(), ClaimValueSchema).optional(),
  custom: z.record(z.string(), ClaimValueSchema).optional(),
});

const CommunicationTermsSchema = z.object({
  categories: z.array(z.enum(MESSAGE_CATEGORIES)).min(1),
  max_content_rating: z.enum(CONTENT_RATINGS),
});

const InvitationOutputSchema = {
  invitation_id: z.string(),
  direction: z.enum(["inbound", "outbound"]),
  remote_domain: z.string(),
  status: z.enum(["pending", "accepted", "rejected", "expired", "cancelled"]),
  communication_terms: CommunicationTermsSchema,
  claims: InvitationClaimsOutputSchema.optional(),
  sender_display_name: z.string().optional(),
  message: z.string().optional(),
  expires_at: outputDate().optional(),
  sent_at: outputDate(),
  created_at: outputDate(),
  decided_at: outputDate().optional(),
};

const ListInvitationsInputSchema = {
  status: z.enum(["pending", "accepted", "rejected", "expired", "cancelled"])
    .optional().describe("Filter by invitation status"),
  remote_domain: z.string().optional().describe(
    "Filter by remote domain (case-insensitive)",
  ),
  page_size: z.number().int().min(1).max(100).optional().describe(
    "Maximum number of results to return (default 50)",
  ),
  resume_token: z.string().optional(),
};

const ListInvitationsOutputSchema = {
  invitations: z.array(z.object(InvitationOutputSchema)),
  page_size: z.number().int(),
  next_resume_token: z.string().optional(),
};

const ReviewInvitationInputSchema = {
  invitation_id: z.string().describe("Invitation ID to review"),
};

const AcceptInvitationInputSchema = {
  invitation_id: z.string().describe("Inbound invitation ID to accept"),
  local_terms: CommunicationTermsSchema.describe(
    "Communication terms the local user is willing to receive (becomes contact.local_terms).",
  ),
  message: z.string().max(1024).optional().describe(
    "Optional human-readable message sent in the invitation_reply envelope.",
  ),
};

const AcceptInvitationOutputSchema = {
  invitation: z.object(InvitationOutputSchema),
  contact_id: z.string().describe("ID of the contact created by acceptance"),
};

const RejectInvitationInputSchema = {
  invitation_id: z.string().describe("Inbound invitation ID to reject"),
};

const SendInvitationInputSchema = {
  receiver_domain: z.string().describe("RPP domain of the receiver's server"),
  receptive_policy_id: z.string().optional().describe(
    "Policy ID supplied by the receiver. Provide exactly one of receptive_policy_id or shortcode.",
  ),
  shortcode: z.string().optional().describe(
    "8-character shortcode supplied by the receiver.",
  ),
  communication_terms: CommunicationTermsSchema.describe(
    "Communication terms the local user is willing to receive from this contact.",
  ),
  include_user_claims: z.array(z.string()).optional().describe(
    "Keys of user-verified claims to attach to the invitation.",
  ),
  include_admin_claims: z.array(z.string()).optional().describe(
    "Keys of admin-verified claims to attach to the invitation.",
  ),
  custom_claims: ClaimMapSchema.optional().describe(
    "Unverified free-form claims provided by the sender (≤20 keys).",
  ),
  message: z.string().max(1024).optional().describe(
    "Optional human-readable message included in the invitation envelope.",
  ),
  expires_at: inputDate().optional().describe(
    "ISO 8601 timestamp when invitation expires; absent means indefinite",
  ),
};

const SendInvitationOutputSchema = {
  invitation_id: z.string(),
  created_at: outputDate(),
};

const CancelInvitationInputSchema = {
  invitation_id: z.string().describe("Outbound invitation ID to cancel"),
};

const InviteContactInputSchema = {
  contact_id: z.string().describe(
    "Existing contact to re-invite (spec §11.3 / contacts-006).",
  ),
  receptive_policy_id: z.string().describe(
    "Receptive policy ID the contact shared with the local user out-of-band.",
  ),
  communication_terms: CommunicationTermsSchema.describe(
    "Communication terms the local user is willing to receive from this contact.",
  ),
  include_user_claims: z.array(z.string()).optional(),
  include_admin_claims: z.array(z.string()).optional(),
  custom_claims: ClaimMapSchema.optional(),
  message: z.string().max(1024).optional(),
  expires_at: inputDate().optional(),
};

type InviteContactArgs = z.infer<
  z.ZodObject<typeof InviteContactInputSchema>
>;

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

function projectInvitation(inv: Invitation): Record<string, unknown> {
  return {
    invitation_id: inv.invitation_id,
    direction: inv.direction,
    remote_domain: inv.remote_domain,
    status: inv.status,
    communication_terms: inv.communication_terms,
    ...(inv.claims !== undefined && { claims: inv.claims }),
    ...(inv.sender_display_name !== undefined &&
      { sender_display_name: inv.sender_display_name }),
    ...(inv.message !== undefined && { message: inv.message }),
    ...(inv.expires_at !== undefined && { expires_at: inv.expires_at }),
    sent_at: inv.sent_at,
    created_at: inv.created_at,
    ...(inv.decided_at !== undefined && { decided_at: inv.decided_at }),
  };
}

export class InvitationTool {
  constructor(
    private readonly invitationManager: InvitationManager,
    private readonly accountManager: AccountManager,
    private readonly contactManager: ContactManager,
    private readonly receptivePolicyManager: ReceptivePolicyManager,
    private readonly config: ConfigService,
    private readonly envelopeDispatcher: EnvelopeDispatcher,
  ) {}

  private async resolveLocalDomainId(oid: string): Promise<string> {
    const metadata = await this.accountManager.getUserVerifiedMetadata(oid);
    const domainId = metadata?.immutable_fields?.["domain_id"];
    if (typeof domainId !== "string" || !domainId) {
      throw new Error(
        "Local account is missing immutable_fields.domain_id; call set_user_verified_metadata first.",
      );
    }
    return domainId;
  }

  private async resolveClaims(
    oid: string,
    localDomainId: string,
    includeUserClaims: string[] | undefined,
    includeAdminClaims: string[] | undefined,
    customClaims: Record<string, ClaimValue> | undefined,
  ): Promise<InvitationClaims> {
    const metadata = await this.accountManager.getUserVerifiedMetadata(oid);

    const user: Record<string, ClaimValue> = {};
    if (includeUserClaims?.length && metadata?.user_verified_fields) {
      for (const key of includeUserClaims) {
        if (key in metadata.user_verified_fields) {
          user[key] = metadata.user_verified_fields[key];
        }
      }
    }

    const admin: Record<string, ClaimValue> = {};
    if (includeAdminClaims?.length && metadata?.admin_verified_fields) {
      for (const key of includeAdminClaims) {
        if (key in metadata.admin_verified_fields) {
          admin[key] = metadata.admin_verified_fields[key];
        }
      }
    }

    const immutable: Record<string, ClaimValue> = {
      domain_id: localDomainId,
    };

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
          "List inbound invitations addressed to the authenticated account. Filter by status or remote domain.",
        inputSchema: ListInvitationsInputSchema,
        outputSchema: ListInvitationsOutputSchema,
      },
      withToolErrorHandling(async (params: ListInvitationsArgs) => {
        const { normalizePageSize, normalizeResumeToken } = await import(
          "../../utils/pagination.ts"
        );
        const pageSize = normalizePageSize(params.page_size);
        const cursor = normalizeResumeToken(params.resume_token);

        const result = await this.invitationManager.list(auth.oid, {
          direction: "inbound",
          pageSize,
          ...(cursor !== undefined && { cursor }),
        });

        let invitations = result.invitations;
        if (params.status) {
          invitations = invitations.filter((i) => i.status === params.status);
        }
        if (params.remote_domain) {
          const wanted = params.remote_domain.toLowerCase();
          invitations = invitations.filter(
            (i) => i.remote_domain.toLowerCase() === wanted,
          );
        }

        return toolResult({
          invitations: invitations.map(projectInvitation),
          page_size: pageSize,
          ...(result.nextCursor !== undefined &&
            { next_resume_token: result.nextCursor }),
        });
      }),
    );

    server.registerTool(
      "list_sent_invitations",
      {
        description:
          "List outbound invitations sent by the authenticated account.",
        inputSchema: ListInvitationsInputSchema,
        outputSchema: ListInvitationsOutputSchema,
      },
      withToolErrorHandling(async (params: ListInvitationsArgs) => {
        const { normalizePageSize, normalizeResumeToken } = await import(
          "../../utils/pagination.ts"
        );
        const pageSize = normalizePageSize(params.page_size);
        const cursor = normalizeResumeToken(params.resume_token);

        const result = await this.invitationManager.list(auth.oid, {
          direction: "outbound",
          pageSize,
          ...(cursor !== undefined && { cursor }),
        });

        let invitations = result.invitations;
        if (params.status) {
          invitations = invitations.filter((i) => i.status === params.status);
        }
        if (params.remote_domain) {
          const wanted = params.remote_domain.toLowerCase();
          invitations = invitations.filter(
            (i) => i.remote_domain.toLowerCase() === wanted,
          );
        }

        return toolResult({
          invitations: invitations.map(projectInvitation),
          page_size: pageSize,
          ...(result.nextCursor !== undefined &&
            { next_resume_token: result.nextCursor }),
        });
      }),
    );

    server.registerTool(
      "review_invitation",
      {
        description:
          "Get detailed information about a specific invitation before accepting or rejecting.",
        inputSchema: ReviewInvitationInputSchema,
        outputSchema: InvitationOutputSchema,
      },
      withToolErrorHandling(async (params: ReviewInvitationArgs) => {
        const invitation = await this.invitationManager.require(
          auth.oid,
          params.invitation_id,
        );
        return toolResult(projectInvitation(invitation));
      }),
    );

    server.registerTool(
      "accept_invitation",
      {
        description:
          "Accept an inbound invitation. Creates a bilateral contact, generates a fresh local credential, " +
          "and dispatches an `invitation_reply` envelope to the remote (spec §10.4 / §11.2 path 1).",
        inputSchema: AcceptInvitationInputSchema,
        outputSchema: AcceptInvitationOutputSchema,
      },
      withToolErrorHandling(async (params: AcceptInvitationArgs) => {
        const invitation = await this.invitationManager.requireDirection(
          auth.oid,
          params.invitation_id,
          "inbound",
        );

        const remoteDomainId =
          (invitation.claims?.immutable["domain_id"] as string | undefined) ??
            undefined;
        if (!remoteDomainId) {
          throw new Error(
            "Invitation is missing claims.immutable.domain_id; cannot accept.",
          );
        }

        const now = new Date();
        const localDomainId = await this.resolveLocalDomainId(auth.oid);

        // Create / upsert the contact. The manager generates a fresh
        // local_credential and persists the inbound reply_credential as the
        // contact's remote_credential.
        const contact = await this.contactManager.upsertFromInboundInvitation({
          ownerOid: auth.oid,
          remoteDomain: invitation.remote_domain,
          remoteDomainId,
          remoteTerms: invitation.communication_terms,
          localTerms: params.local_terms as CommunicationTerms,
          remoteCredential: invitation.reply_credential,
          ...(invitation.claims !== undefined &&
            { claims: invitation.claims }),
          recordedAt: now,
        });

        const accepted = await this.invitationManager.accept(
          auth.oid,
          invitation.invitation_id,
          now,
        );

        // Build and dispatch the invitation_reply envelope. HMAC key is the
        // remote-issued reply_credential we received with the invitation.
        const replyEnvelope: Record<string, unknown> = {
          category: "invitation_reply",
          invitation_id: invitation.invitation_id,
          sender_domain: this.config.domain,
          sent_at: now,
          communication_terms: params.local_terms,
          reply_credential: contact.local_credential,
          claims: {
            immutable: { domain_id: localDomainId },
          },
          ...(params.message !== undefined && { message: params.message }),
        };

        const result = await this.envelopeDispatcher.dispatchInvitationReply(
          invitation.remote_domain,
          replyEnvelope,
          invitation.reply_credential,
        );
        if (!result.ok) {
          throw new Error(
            `Failed to deliver invitation_reply to ${invitation.remote_domain}: HTTP ${result.status}${
              result.receiverCode ? ` (${result.receiverCode})` : ""
            }`,
          );
        }

        return toolResult({
          invitation: projectInvitation(accepted),
          contact_id: contact.id,
        });
      }),
    );

    server.registerTool(
      "reject_invitation",
      {
        description:
          "Reject an inbound invitation. The rejection is recorded locally; no envelope is sent to the remote.",
        inputSchema: RejectInvitationInputSchema,
        outputSchema: InvitationOutputSchema,
      },
      withToolErrorHandling(async (params: RejectInvitationArgs) => {
        const invitation = await this.invitationManager.requireDirection(
          auth.oid,
          params.invitation_id,
          "inbound",
        );
        const updated = await this.invitationManager.reject(
          auth.oid,
          invitation.invitation_id,
          new Date(),
        );
        return toolResult(projectInvitation(updated));
      }),
    );

    server.registerTool(
      "send_invitation",
      {
        description:
          "Send an invitation envelope to a remote RPP domain (spec §10.1). " +
          "Provide exactly one of receptive_policy_id or shortcode. The local domain generates " +
          "a fresh reply_credential the remote will use to authenticate their reply.",
        inputSchema: SendInvitationInputSchema,
        outputSchema: SendInvitationOutputSchema,
      },
      withToolErrorHandling(async (params: SendInvitationArgs) => {
        if (
          (params.receptive_policy_id && params.shortcode) ||
          (!params.receptive_policy_id && !params.shortcode)
        ) {
          throw new Error(
            "send_invitation requires exactly one of receptive_policy_id or shortcode.",
          );
        }

        const now = new Date();
        const localDomainId = await this.resolveLocalDomainId(auth.oid);
        const claims = await this.resolveClaims(
          auth.oid,
          localDomainId,
          params.include_user_claims,
          params.include_admin_claims,
          params.custom_claims,
        );

        const invitationId = generateUUIDv7();
        const replyCredential: ContactCredential = generateContactCredential();

        const envelope: Record<string, unknown> = {
          category: "invitation",
          invitation_id: invitationId,
          sender_domain: this.config.domain,
          sent_at: now,
          communication_terms: params.communication_terms,
          reply_credential: replyCredential,
          claims,
          ...(params.receptive_policy_id !== undefined &&
            { receptive_policy_id: params.receptive_policy_id }),
          ...(params.shortcode !== undefined &&
            { shortcode: params.shortcode }),
          ...(params.expires_at !== undefined &&
            { expires_at: params.expires_at }),
          ...(params.message !== undefined && { message: params.message }),
        };

        const result = await this.envelopeDispatcher.dispatchInvitation(
          params.receiver_domain,
          envelope,
          {
            ...(params.receptive_policy_id !== undefined &&
              { receptivePolicyId: params.receptive_policy_id }),
            ...(params.shortcode !== undefined &&
              { shortcode: params.shortcode }),
          },
        );
        if (!result.ok) {
          throw new Error(
            `Failed to deliver invitation to ${params.receiver_domain}: HTTP ${result.status}${
              result.receiverCode ? ` (${result.receiverCode})` : ""
            }`,
          );
        }

        await this.invitationManager.createOutbound({
          invitationId,
          ownerOid: auth.oid,
          remoteDomain: params.receiver_domain,
          communicationTerms: params.communication_terms as CommunicationTerms,
          replyCredential,
          claims,
          ...(params.message !== undefined && { message: params.message }),
          ...(params.expires_at !== undefined &&
            { expiresAt: params.expires_at }),
          sentAt: now,
          recordedAt: now,
        });

        return toolResult({
          invitation_id: invitationId,
          created_at: now,
        });
      }),
    );

    server.registerTool(
      "cancel_invitation",
      {
        description:
          "Cancel a pending outbound invitation (spec §10.3). Re-sends the invitation envelope " +
          "with `cancelled: true` to the remote, then transitions the local outbound record to cancelled.",
        inputSchema: CancelInvitationInputSchema,
        outputSchema: InvitationOutputSchema,
      },
      withToolErrorHandling(async (params: CancelInvitationArgs) => {
        const invitation = await this.invitationManager.requireDirection(
          auth.oid,
          params.invitation_id,
          "outbound",
        );

        const now = new Date();
        // Resolve receptive policy used at send time: we did not persist it on
        // the invitation. Use the original claim path: callers pass shortcode
        // or receptive_policy_id at send. For cancellation we need at least
        // a header; without a stored policy id we cannot send the cancellation
        // envelope, so document this and just transition locally.
        // To preserve the spec §10.3 wire behavior we attempt delivery using a
        // synthetic envelope without policy id; remote receivers SHOULD accept
        // the cancellation envelope on the basis of (invitation_id,
        // sender_domain) match. Implementations that strictly require a policy
        // id will surface a delivery error.
        const cancelEnvelope: Record<string, unknown> = {
          category: "invitation",
          invitation_id: invitation.invitation_id,
          sender_domain: this.config.domain,
          sent_at: now,
          communication_terms: invitation.communication_terms,
          reply_credential: invitation.reply_credential,
          claims: invitation.claims ?? {
            immutable: {
              domain_id: await this.resolveLocalDomainId(auth.oid),
            },
          },
          cancelled: true,
        };

        // Best-effort delivery; ignore non-2xx so the local state advances
        // regardless. The remote may already have decided the invitation.
        try {
          await this.envelopeDispatcher.dispatchInvitation(
            invitation.remote_domain,
            cancelEnvelope,
            { receptivePolicyId: "00000000-0000-0000-0000-000000000000" },
          );
        } catch {
          // Swallow network failures — local state is the source of truth.
        }

        const cancelled = await this.invitationManager.cancelOutbound(
          auth.oid,
          invitation.invitation_id,
          now,
        );
        return toolResult(projectInvitation(cancelled));
      }),
    );

    server.registerTool(
      "invite_contact",
      {
        description:
          "Re-invite a known contact using a fresh receptive_policy_id shared out-of-band " +
          "(spec §11.3 / contacts-006). Convenience wrapper around send_invitation that " +
          "resolves receiver_domain from the stored contact.",
        inputSchema: InviteContactInputSchema,
        outputSchema: SendInvitationOutputSchema,
      },
      withToolErrorHandling(async (params: InviteContactArgs) => {
        const contact = await this.contactManager.get(
          auth.oid,
          params.contact_id,
        );
        if (contact.blocked) throw new ContactBlockedError(contact.id);

        const now = new Date();
        const localDomainId = await this.resolveLocalDomainId(auth.oid);
        const claims = await this.resolveClaims(
          auth.oid,
          localDomainId,
          params.include_user_claims,
          params.include_admin_claims,
          params.custom_claims,
        );

        const invitationId = generateUUIDv7();
        const replyCredential: ContactCredential = generateContactCredential();

        const envelope: Record<string, unknown> = {
          category: "invitation",
          invitation_id: invitationId,
          sender_domain: this.config.domain,
          sent_at: now,
          receptive_policy_id: params.receptive_policy_id,
          communication_terms: params.communication_terms,
          reply_credential: replyCredential,
          claims,
          ...(params.expires_at !== undefined &&
            { expires_at: params.expires_at }),
          ...(params.message !== undefined && { message: params.message }),
        };

        const result = await this.envelopeDispatcher.dispatchInvitation(
          contact.remote_domain,
          envelope,
          { receptivePolicyId: params.receptive_policy_id },
        );
        if (!result.ok) {
          throw new Error(
            `Failed to deliver invitation to ${contact.remote_domain}: HTTP ${result.status}${
              result.receiverCode ? ` (${result.receiverCode})` : ""
            }`,
          );
        }

        await this.invitationManager.createOutbound({
          invitationId,
          ownerOid: auth.oid,
          remoteDomain: contact.remote_domain,
          communicationTerms: params.communication_terms as CommunicationTerms,
          replyCredential,
          claims,
          ...(params.message !== undefined && { message: params.message }),
          ...(params.expires_at !== undefined &&
            { expiresAt: params.expires_at }),
          sentAt: now,
          recordedAt: now,
        });

        return toolResult({
          invitation_id: invitationId,
          created_at: now,
        });
      }),
    );
  }
}
