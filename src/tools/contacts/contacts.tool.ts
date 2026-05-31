import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthInfo } from "../../context.ts";
import type { ContactManager } from "../../managers/mod.ts";
import { CONTENT_RATINGS, MESSAGE_CATEGORIES } from "../../models/mod.ts";
import type {
  Contact,
  ContactFieldRecord,
  CurrentContactFields,
} from "../../models/mod.ts";
import { flatMerge } from "../../managers/contacts/contact.manager.ts";
import { toolResult, withToolErrorHandling } from "../tool-result.ts";
import { outputDate } from "../date-schema.ts";

const ClaimValueOutputSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])),
]);

const ContactFieldRecordSchema = z.object({
  value: ClaimValueOutputSchema,
  source: z.enum([
    "sender_verified",
    "domain_admin",
    "sender_custom",
    "owner_note",
  ]),
  recorded_at: outputDate(),
});

const CommunicationTermsOutputSchema = z.object({
  categories: z.array(z.enum(MESSAGE_CATEGORIES)),
  max_content_rating: z.enum(CONTENT_RATINGS),
});

const ContactOutputSchema = {
  id: z.string().describe("Local contact ID"),
  remote_domain: z.string().describe("Remote party's RPP domain"),
  remote_domain_id: z.string().describe(
    "Remote party's domain_id (scoped to remote_domain)",
  ),
  remote_terms: CommunicationTermsOutputSchema.describe(
    "Communication terms the remote declared",
  ),
  local_terms: CommunicationTermsOutputSchema.describe(
    "Communication terms the local user declared",
  ),
  blocked: z.boolean().describe(
    "Whether this contact is blocked. Blocked contacts cannot send or receive messages.",
  ),
  current_fields: z.record(z.string(), ContactFieldRecordSchema).describe(
    "Flat-merged view: most-recent value per field key (all sources).",
  ),
  fields: z.record(z.string(), z.array(ContactFieldRecordSchema)).describe(
    "Full history per field key, newest first.",
  ),
  created_at: outputDate().describe("ISO 8601 timestamp of contact creation"),
  updated_at: outputDate().describe(
    "ISO 8601 timestamp of last contact update",
  ),
};

const ListContactsInputSchema = {
  blocked: z.boolean().optional().describe(
    "Filter by blocked status: true returns only blocked contacts, false returns only unblocked. Omit to include both.",
  ),
  page_size: z.number().int().min(1).max(200).optional().describe(
    "Number of contacts per page (1-200, default 50)",
  ),
  resume_token: z.string().optional().describe(
    "Opaque token from a previous call to continue pagination",
  ),
};

const ListContactsOutputSchema = {
  contacts: z.array(z.object(ContactOutputSchema)).describe("List of contacts"),
  page_size: z.number().describe("Effective page size used"),
  next_resume_token: z.string().optional().describe(
    "Token to pass as resume_token for the next page; absent when no more pages",
  ),
};

const GetContactInputSchema = {
  contact_id: z.string().describe("ID of the contact to fetch"),
};

const DeleteContactInputSchema = {
  contact_id: z.string().describe("ID of the contact to delete"),
};

const DeleteContactOutputSchema = {
  contact_id: z.string(),
  deleted: z.literal(true),
};

const BlockContactInputSchema = {
  contact_id: z.string().describe("ID of the contact to block"),
};

const UnblockContactInputSchema = {
  contact_id: z.string().describe("ID of the contact to unblock"),
};

const SetContactFieldInputSchema = {
  contact_id: z.string().describe("ID of the contact to update"),
  key: z.string().min(1).max(64).describe("Field key (≤64 chars)"),
  value: z.union([
    z.string().max(512),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(z.union([z.string().max(512), z.number(), z.boolean(), z.null()]))
      .max(20),
  ]).describe(
    "Field value. Recorded as a fresh owner_note record on top of existing history.",
  ),
};

type ListContactsArgs = z.infer<z.ZodObject<typeof ListContactsInputSchema>>;
type GetContactArgs = z.infer<z.ZodObject<typeof GetContactInputSchema>>;
type DeleteContactArgs = z.infer<z.ZodObject<typeof DeleteContactInputSchema>>;
type BlockContactArgs = z.infer<z.ZodObject<typeof BlockContactInputSchema>>;
type UnblockContactArgs = z.infer<
  z.ZodObject<typeof UnblockContactInputSchema>
>;
type SetContactFieldArgs = z.infer<
  z.ZodObject<typeof SetContactFieldInputSchema>
>;

function projectContact(contact: Contact): Record<string, unknown> {
  const current_fields: CurrentContactFields = flatMerge(contact.fields);
  return {
    id: contact.id,
    remote_domain: contact.remote_domain,
    remote_domain_id: contact.remote_domain_id,
    remote_terms: contact.remote_terms,
    local_terms: contact.local_terms,
    blocked: contact.blocked,
    current_fields,
    fields: contact.fields,
    created_at: contact.created_at,
    updated_at: contact.updated_at,
  };
}

export class ContactTool {
  constructor(private readonly contactManager: ContactManager) {}

  register(server: McpServer, auth: AuthInfo): void {
    server.registerTool(
      "list_contacts",
      {
        description:
          "List contacts owned by the authenticated account. Returns the bilateral contact records " +
          "established via accepted invitations (spec §11). Supports filtering by blocked status.",
        inputSchema: ListContactsInputSchema,
        outputSchema: ListContactsOutputSchema,
      },
      withToolErrorHandling(async (params: ListContactsArgs) => {
        const { normalizePageSize, normalizeResumeToken } = await import(
          "../../utils/pagination.ts"
        );
        const pageSize = normalizePageSize(params.page_size);
        const cursor = normalizeResumeToken(params.resume_token);

        const result = await this.contactManager.list(auth.oid, {
          pageSize,
          ...(cursor !== undefined && { cursor }),
          ...(params.blocked !== undefined && { blocked: params.blocked }),
        });

        return toolResult({
          contacts: result.contacts.map(projectContact),
          page_size: pageSize,
          ...(result.nextCursor !== undefined &&
            { next_resume_token: result.nextCursor }),
        });
      }),
    );

    server.registerTool(
      "get_contact",
      {
        description:
          "Retrieve a single contact by id. Returns 404 when not owned by the caller.",
        inputSchema: GetContactInputSchema,
        outputSchema: ContactOutputSchema,
      },
      withToolErrorHandling(async (params: GetContactArgs) => {
        const contact = await this.contactManager.get(
          auth.oid,
          params.contact_id,
        );
        return toolResult(projectContact(contact));
      }),
    );

    server.registerTool(
      "delete_contact",
      {
        description:
          "Permanently delete a contact and its history. Both directions of communication " +
          "become unsignable; pending invitations are unaffected.",
        inputSchema: DeleteContactInputSchema,
        outputSchema: DeleteContactOutputSchema,
      },
      withToolErrorHandling(async (params: DeleteContactArgs) => {
        await this.contactManager.delete(auth.oid, params.contact_id);
        return toolResult({
          contact_id: params.contact_id,
          deleted: true as const,
        });
      }),
    );

    server.registerTool(
      "block_contact",
      {
        description:
          "Mark a contact as blocked. Inbound and outbound messaging through this contact " +
          "is refused until the contact is unblocked (spec §11.6).",
        inputSchema: BlockContactInputSchema,
        outputSchema: ContactOutputSchema,
      },
      withToolErrorHandling(async (params: BlockContactArgs) => {
        const contact = await this.contactManager.block(
          auth.oid,
          params.contact_id,
        );
        return toolResult(projectContact(contact));
      }),
    );

    server.registerTool(
      "unblock_contact",
      {
        description:
          "Clear the blocked flag on a contact, restoring inbound and outbound messaging.",
        inputSchema: UnblockContactInputSchema,
        outputSchema: ContactOutputSchema,
      },
      withToolErrorHandling(async (params: UnblockContactArgs) => {
        const contact = await this.contactManager.unblock(
          auth.oid,
          params.contact_id,
        );
        return toolResult(projectContact(contact));
      }),
    );

    server.registerTool(
      "set_contact_field",
      {
        description:
          "Record an owner-supplied field value for a contact. The new record is appended " +
          "as source `owner_note`; existing values from other sources are preserved.",
        inputSchema: SetContactFieldInputSchema,
        outputSchema: ContactOutputSchema,
      },
      withToolErrorHandling(async (params: SetContactFieldArgs) => {
        const contact = await this.contactManager.setCustomField(
          auth.oid,
          params.contact_id,
          params.key,
          params.value as ContactFieldRecord["value"],
        );
        return toolResult(projectContact(contact));
      }),
    );
  }
}
