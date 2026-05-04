import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthInfo } from "../../context.ts";
import type { ContactManager } from "../../managers/contacts/contact.manager.ts";
import type {
  AccountManager,
  DomainIdentityManager,
  InvitationManager,
} from "../../managers/mod.ts";
import { CONTENT_RATINGS, MESSAGE_CATEGORIES } from "../../models/mod.ts";
import type { ConfigService } from "../../services/config/config.service.ts";
import { toolResult, withToolErrorHandling } from "../tool-result.ts";
import { inputDate, outputDate } from "../date-schema.ts";

// ── shared schemas ──────────────────────────────────────────────────────────

const ClaimValueSchema = z.union([
  z.string().max(512),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.union([z.string().max(512), z.number(), z.boolean(), z.null()]))
    .max(20),
]);

const ContactFieldRecordSchema = z.object({
  value: ClaimValueSchema,
  source: z.enum([
    "sender_verified",
    "domain_admin",
    "sender_custom",
    "owner_note",
  ]),
  recorded_at: outputDate(),
});

const CurrentFieldsSchema = z.record(z.string(), ContactFieldRecordSchema);

const ContactOutputSchema = {
  id: z.string().describe("Contact ID (server-assigned synthetic UUID)"),
  domain: z.string().describe("Issuing hostname for this contact"),
  domain_id: z.string().uuid().describe("domain_id UUID scoped to domain"),
  current_fields: CurrentFieldsSchema.describe(
    "Flat-merged most-recent claim fields",
  ),
  created_at: outputDate(),
  updated_at: outputDate(),
};

const ContactDetailOutputSchema = {
  ...ContactOutputSchema,
  fields: z.record(
    z.string(),
    z.array(ContactFieldRecordSchema),
  ).describe("Full field history per key, newest-first"),
};

// ── send invitation shared helpers (re-used from invite_contact) ─────────────

const CategorySchema = z.enum(MESSAGE_CATEGORIES);
const ContentRatingSchema = z.enum(CONTENT_RATINGS);

const ProposedTermsSchema = z.object({
  category: CategorySchema,
  max_content_rating: ContentRatingSchema.optional(),
  usage_policy: z.enum(["one-time", "multiple-time", "any-time"]).optional(),
}).catchall(z.unknown());

const CustomClaimsSchema = z.record(z.string().max(64), ClaimValueSchema)
  .refine((v) => Object.keys(v).length <= 20, {
    message: "custom claims must not exceed 20 keys",
  });

// ── input schemas ────────────────────────────────────────────────────────────

const ListContactsInputSchema = {
  page_size: z.number().int().min(1).max(100).optional().describe(
    "Maximum number of results to return (default 50)",
  ),
  resume_token: z.string().optional().describe(
    "Opaque token from a previous call to continue listing",
  ),
};

const GetContactInputSchema = {
  contact_id: z.string().describe(
    "Contact ID (server-assigned synthetic UUID)",
  ),
};

const DeleteContactInputSchema = {
  contact_id: z.string().describe("Contact ID to delete"),
};

const SetContactFieldInputSchema = {
  contact_id: z.string().describe(
    "Contact ID (server-assigned synthetic UUID)",
  ),
  key: z.string().max(64).describe("Field name to set"),
  value: ClaimValueSchema.describe(
    "Field value: string, number, boolean, null, or an array of those types",
  ),
};

const InviteContactInputSchema = {
  contact_id: z.string().describe(
    "Contact ID (server-assigned synthetic UUID)",
  ),
  receptive_policy_id: z.string().uuid().optional().describe(
    "Policy ID from the receiver's open receptive window. Supply either this or receipt_id.",
  ),
  receipt_id: z.string().uuid().optional().describe(
    "Receipt ID from a prior accepted invitation. Supply either this or receptive_policy_id.",
  ),
  proposed_terms: ProposedTermsSchema.describe(
    "Receipt terms proposed to receiver",
  ),
  include_user_claims: z.array(z.string()).optional().describe(
    "Keys of user-verified claims to attach",
  ),
  include_admin_claims: z.array(z.string()).optional().describe(
    "Keys of admin-verified claims to attach",
  ),
  custom_claims: CustomClaimsSchema.optional().describe(
    "Free-form claims provided by the sender",
  ),
  expires_at: inputDate().optional().describe(
    "ISO 8601 timestamp when invitation expires; absent means indefinite",
  ),
};

// ── output schemas ────────────────────────────────────────────────────────────

const ListContactsOutputSchema = {
  contacts: z.array(z.object(ContactOutputSchema)),
  page_size: z.number().int(),
  next_resume_token: z.string().optional(),
};

const DeleteContactOutputSchema = {
  contact_id: z.string(),
  deleted: z.boolean(),
};

const SetContactFieldOutputSchema = ContactDetailOutputSchema;

const InviteContactOutputSchema = {
  invitation_id: z.string().describe("Unique invitation identifier"),
  created_at: outputDate(),
};

// ── type inference ────────────────────────────────────────────────────────────

type ListContactsArgs = z.infer<z.ZodObject<typeof ListContactsInputSchema>>;
type GetContactArgs = z.infer<z.ZodObject<typeof GetContactInputSchema>>;
type DeleteContactArgs = z.infer<z.ZodObject<typeof DeleteContactInputSchema>>;
type SetContactFieldArgs = z.infer<
  z.ZodObject<typeof SetContactFieldInputSchema>
>;
type InviteContactArgs = z.infer<z.ZodObject<typeof InviteContactInputSchema>>;

// ── helpers ───────────────────────────────────────────────────────────────────

import type {
  Contact,
  InvitationClaims,
  ReceiptTerms,
} from "../../models/mod.ts";
import { flatMerge } from "../../managers/contacts/contact.manager.ts";

function toContactOutput(c: Contact) {
  return {
    id: c.id,
    domain: c.domain,
    domain_id: c.domain_id,
    current_fields: flatMerge(c.fields),
    created_at: c.created_at,
    updated_at: c.updated_at,
  };
}

function toContactDetailOutput(c: Contact) {
  return {
    ...toContactOutput(c),
    fields: c.fields,
  };
}

// ── tool class ────────────────────────────────────────────────────────────────

export class ContactTool {
  constructor(
    private readonly contactManager: ContactManager,
    private readonly invitationManager: InvitationManager,
    private readonly accountManager: AccountManager,
    private readonly domainIdentityManager: DomainIdentityManager,
    private readonly config: ConfigService,
  ) {}

  register(server: McpServer, auth: AuthInfo): void {
    // list_contacts
    server.registerTool(
      "list_contacts",
      {
        description:
          "List all contacts for your account with flat-merged current fields.",
        inputSchema: ListContactsInputSchema,
        outputSchema: ListContactsOutputSchema,
      },
      withToolErrorHandling(async (params: ListContactsArgs) => {
        const result = await this.contactManager.list(auth.oid, {
          pageSize: params.page_size,
          cursor: params.resume_token,
        });
        return toolResult({
          contacts: result.contacts.map(toContactOutput),
          page_size: result.contacts.length,
          ...(result.nextCursor !== undefined && {
            next_resume_token: result.nextCursor,
          }),
        });
      }),
    );

    // get_contact
    server.registerTool(
      "get_contact",
      {
        description: "Retrieve a single contact including full field history.",
        inputSchema: GetContactInputSchema,
        outputSchema: ContactDetailOutputSchema,
      },
      withToolErrorHandling(async (params: GetContactArgs) => {
        const contact = await this.contactManager.get(
          auth.oid,
          params.contact_id,
        );
        return toolResult(toContactDetailOutput(contact));
      }),
    );

    // delete_contact
    server.registerTool(
      "delete_contact",
      {
        description:
          "Permanently delete a contact record. Does not revoke any receipts.",
        inputSchema: DeleteContactInputSchema,
        outputSchema: DeleteContactOutputSchema,
      },
      withToolErrorHandling(async (params: DeleteContactArgs) => {
        await this.contactManager.delete(auth.oid, params.contact_id);
        return toolResult({ contact_id: params.contact_id, deleted: true });
      }),
    );

    // set_contact_field
    server.registerTool(
      "set_contact_field",
      {
        description: "Add an owner-authored custom field value to a contact. " +
          "Prepends a new record to the field's history; never overwrites existing entries.",
        inputSchema: SetContactFieldInputSchema,
        outputSchema: SetContactFieldOutputSchema,
      },
      withToolErrorHandling(async (params: SetContactFieldArgs) => {
        const contact = await this.contactManager.setCustomField(
          auth.oid,
          params.contact_id,
          params.key,
          params.value,
        );
        return toolResult(toContactDetailOutput(contact));
      }),
    );

    // invite_contact
    server.registerTool(
      "invite_contact",
      {
        description:
          "Send an invitation to a known contact, resolving their domain automatically. " +
          "You MUST supply exactly one of: receptive_policy_id or receipt_id. " +
          "To reply to a received message: use the receptive_policy_id from the message's reply_invite field " +
          "(call get_message or list_messages and read reply_invite.receptive_policy_id). " +
          "To re-invite an existing contact without a new window: use their receipt_id. " +
          "Fails if the contact is not found, no addressing field is provided, or delivery fails. " +
          "Note: the invitation process is asynchronous — acceptance is not guaranteed.",
        inputSchema: InviteContactInputSchema,
        outputSchema: InviteContactOutputSchema,
      },
      withToolErrorHandling(async (params: InviteContactArgs) => {
        if (!params.receptive_policy_id && !params.receipt_id) {
          throw new Error(
            "invite_contact requires either receptive_policy_id or receipt_id. " +
              "Supply the receptive_policy_id from the contact's reply_invite (embedded in received messages), " +
              "or the receipt_id from a prior accepted invitation.",
          );
        }

        // Resolve the receiver domain from the contact.
        const contact = await this.contactManager.get(
          auth.oid,
          params.contact_id,
        );

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

        const envelope = {
          message_id: messageId,
          sender_domain: senderDomain,
          category: "invitation" as const,
          sent_at: createdAt,
          invitation: {
            invitation_id: invitationId,
            ...(params.receptive_policy_id !== undefined && {
              receptive_policy_id: params.receptive_policy_id,
            }),
            ...(params.receipt_id !== undefined && {
              receipt_id: params.receipt_id,
            }),
            proposed_terms: params.proposed_terms,
            claims,
            ...(params.expires_at !== undefined && {
              expires_at: params.expires_at,
            }),
            delivery: {
              domain: senderDomain,
              token: deliveryToken,
            },
          },
        };

        if (contact.domain === senderDomain) {
          // Same-domain: bypass HTTP to avoid Deno Deploy 508 self-loop.
          await this.invitationManager.deliverLocally(
            invitationId,
            messageId,
            senderDomain,
            claims as InvitationClaims,
            params.receptive_policy_id,
            undefined, // shortcode
            params.receipt_id,
            params.proposed_terms as ReceiptTerms,
            params.expires_at,
            { domain: senderDomain, token: deliveryToken },
          );
        } else {
          const receiverIsLocalhost = contact.domain === "localhost" ||
            contact.domain.startsWith("localhost:");
          const scheme = receiverIsLocalhost ? "http" : "https";
          const url = `${scheme}://${contact.domain}/rpp/v1/envelopes`;

          const response = await fetch(url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(envelope),
          });

          if (!response.ok) {
            const body = await response.text();
            throw new Error(
              `Failed to deliver invitation to ${contact.domain}: HTTP ${response.status} — ${body}`,
            );
          }

          // Consume the response body to avoid leaks
          await response.text();
        }

        return toolResult({
          invitation_id: invitationId,
          created_at: createdAt,
        });
      }),
    );
  }

  private async resolveClaims(
    oid: string,
    includeUserKeys?: string[],
    includeAdminKeys?: string[],
    customClaims?: Record<string, unknown>,
  ) {
    const metadata = await this.accountManager.getUserVerifiedMetadata(oid);

    const user: Record<string, unknown> = {};
    if (includeUserKeys?.length && metadata?.user_verified_fields) {
      for (const key of includeUserKeys) {
        if (key in metadata.user_verified_fields) {
          user[key] = metadata.user_verified_fields[key];
        }
      }
    }

    const admin: Record<string, unknown> = {};
    if (includeAdminKeys?.length && metadata?.admin_verified_fields) {
      for (const key of includeAdminKeys) {
        if (key in metadata.admin_verified_fields) {
          admin[key] = metadata.admin_verified_fields[key];
        }
      }
    }

    const immutable: Record<string, unknown> = {};
    const domainId = metadata?.immutable_fields?.["domain_id"];
    if (domainId) immutable["domain_id"] = domainId;

    return {
      immutable,
      ...(Object.keys(user).length && { user }),
      ...(Object.keys(admin).length && { admin }),
      ...(customClaims && Object.keys(customClaims).length && {
        custom: customClaims,
      }),
    };
  }
}
