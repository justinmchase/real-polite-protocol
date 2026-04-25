import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthInfo } from "../../context.ts";
import type { ReceiptManager } from "../../managers/mod.ts";
import { CONTENT_RATINGS, MESSAGE_CATEGORIES } from "../../models/mod.ts";
import { toolResult, withToolErrorHandling } from "../tool-result.ts";

const CategorySchema = z.enum(MESSAGE_CATEGORIES);
const ContentRatingSchema = z.enum(CONTENT_RATINGS);

const RevocationReasonSchema = z.enum([
  "SENDER_REQUEST",
  "CATEGORY_VIOLATION",
  "RATING_VIOLATION",
  "SPAM",
  "ABUSE",
  "OTHER",
  "SUPERSEDED",
]);

const ReceiptOutputSchema = {
  id: z.uuid().describe("Receipt ID to present in x-rpp-receipt-id header"),
  oid: z.uuid().describe("OID of the account that issued this receipt"),
  sender_domain: z.string().describe("Domain this receipt was issued to"),
  sender_domain_id: z.string().optional().describe(
    "Stable sender identity UUID (domain_id from claims.immutable)",
  ),
  category: CategorySchema.describe("Permitted message category"),
  max_content_rating: ContentRatingSchema.describe("Maximum content rating"),
  usage_policy: z.enum(["one-time", "multiple-time", "any-time"]).describe(
    "Usage policy",
  ),
  status: z.enum(["active", "revoked", "expired"]).describe(
    "Current lifecycle state",
  ),
  invitation_id: z.string().optional().describe("Source invitation ID"),
  issued_at: z.coerce.date().describe("ISO 8601 timestamp of issuance"),
  revoked_at: z.coerce.date().optional().describe(
    "ISO 8601 timestamp of revocation",
  ),
  revocation_reason: RevocationReasonSchema.optional().describe(
    "Structured revocation reason",
  ),
  revocation_detail: z.string().optional().describe(
    "Human-readable revocation context",
  ),
};

const ListIssuedReceiptsInputSchema = {
  status: z.enum(["active", "revoked", "expired"]).optional().describe(
    "Filter by receipt status",
  ),
  sender_domain: z.string().optional().describe("Filter by sender domain"),
  page_size: z.number().int().min(1).max(100).optional().describe(
    "Maximum number of results (default 50)",
  ),
  resume_token: z.string().optional().describe(
    "Opaque token from a previous call to continue listing",
  ),
};

const ListIssuedReceiptsOutputSchema = {
  receipts: z.array(z.object(ReceiptOutputSchema)).describe("Issued receipts"),
  page_size: z.number().int().describe("Number of results returned"),
  next_resume_token: z.string().optional().describe(
    "Pass this as resume_token to retrieve the next page; absent means no more results",
  ),
};

const RevokeReceiptInputSchema = {
  receipt_id: z.string().describe("ID of the receipt to revoke"),
  reason: RevocationReasonSchema.describe(
    "Structured revocation reason (Section 10A.1)",
  ),
  reason_detail: z.string().optional().describe(
    "Optional human-readable context for the revocation",
  ),
};

type ListIssuedReceiptsArgs = z.infer<
  z.ZodObject<typeof ListIssuedReceiptsInputSchema>
>;
type RevokeReceiptArgs = z.infer<z.ZodObject<typeof RevokeReceiptInputSchema>>;

export class ReceiptTool {
  constructor(private readonly receiptManager: ReceiptManager) {}

  register(server: McpServer, auth: AuthInfo): void {
    server.registerTool(
      "list_issued_receipts",
      {
        description:
          "List receipts this account has issued to other domains. Supports filtering by status and sender domain.",
        inputSchema: ListIssuedReceiptsInputSchema,
        outputSchema: ListIssuedReceiptsOutputSchema,
      },
      withToolErrorHandling(async (params: ListIssuedReceiptsArgs) => {
        const { receipts, nextCursor } = await this.receiptManager
          .listIssuedByOid(auth.oid, {
            status: params.status,
            senderDomain: params.sender_domain,
            pageSize: params.page_size,
            cursor: params.resume_token,
          });

        return toolResult({
          receipts,
          page_size: receipts.length,
          ...(nextCursor !== undefined && { next_resume_token: nextCursor }),
        });
      }),
    );

    server.registerTool(
      "revoke_receipt",
      {
        description:
          "Revoke an issued receipt. Revocation is immediate: subsequent submit requests from the sender using this receipt will be rejected with E_RECEIPT_REVOKED.",
        inputSchema: RevokeReceiptInputSchema,
        outputSchema: ReceiptOutputSchema,
      },
      withToolErrorHandling(async (params: RevokeReceiptArgs) => {
        const receipt = await this.receiptManager.revoke(
          auth.oid,
          params.receipt_id,
          params.reason,
          params.reason_detail,
        );
        return toolResult(receipt);
      }),
    );
  }
}
