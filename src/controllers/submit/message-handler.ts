import { encodeHex } from "@std/encoding/hex";
import { generate as generateUUIDv7 } from "@std/uuid/v7";
import { z } from "zod";
import type { KvService } from "../../services/kv/kv.service.ts";
import type {
  InvitationManager,
  MessageManager,
  ReceiptManager,
  ReceptivePolicyManager,
} from "../../managers/mod.ts";
import { MESSAGE_CATEGORIES } from "../../models/message-category.ts";
import type { MessageCategory } from "../../models/message-category.ts";
import { CONTENT_RATINGS } from "../../models/content-rating.ts";
import { MessageMetadataSchema } from "../../models/messages/stored-message.model.ts";
import {
  InvitationNotFoundError,
  InvitationNotPendingError,
} from "../../managers/invitation/invitation.error.ts";
import {
  MissingReceiptIdError,
  MissingSignatureError,
  MissingTimestampError,
  ReceiptExpiredError,
  ReceiptInvalidSignatureError,
  ReceiptNotActiveError,
  ReceiptNotFoundError,
  ReceiptRevokedError,
  ReceptivePolicyClosedError,
  ReceptivePolicyExpiredError,
  ReceptivePolicyNotFoundError,
  RequestStaleError,
} from "./submit.error.ts";

const ClaimValueSchema = z.union([
  z.string().max(512),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.union([z.string().max(512), z.number(), z.boolean(), z.null()]))
    .max(20),
]);

const ClaimMapSchema = z.record(z.string().max(64), ClaimValueSchema)
  .refine((v) => Object.keys(v).length <= 20);

const ReceiptTermsSchema = z.object({
  category: z.enum(MESSAGE_CATEGORIES),
  max_content_rating: z.enum(CONTENT_RATINGS).optional(),
  usage_policy: z.enum(["one-time", "multiple-time", "any-time"]).optional(),
  validity_constraints: z.record(z.string(), z.unknown()).optional(),
  interval_budget: z.number().int().positive().optional(),
}).catchall(z.unknown());

const DeliverySchema = z.object({
  domain: z.string(),
  token: z.string(),
});

export const InvitationEnvelopeSchema = z.object({
  message_id: z.string(),
  sender_domain: z.string(),
  category: z.literal("invitation"),
  sent_at: z.coerce.date(),
  invitation: z.object({
    invitation_id: z.string(),
    receptive_policy_id: z.uuid().optional(),
    shortcode: z.string().optional(),
    receipt_id: z.uuid().optional(),
    proposed_terms: ReceiptTermsSchema,
    claims: z.object({
      immutable: ClaimMapSchema,
      user: ClaimMapSchema.optional(),
      admin: ClaimMapSchema.optional(),
      custom: ClaimMapSchema.optional(),
    }).optional(),
    expires_at: z.coerce.date().optional(),
    delivery: DeliverySchema,
  }).refine(
    (d) => {
      const count = [
        d.receptive_policy_id,
        d.shortcode,
        d.receipt_id,
      ].filter((v) => v !== undefined).length;
      return count === 1;
    },
    {
      message:
        "Exactly one of receptive_policy_id, shortcode, or receipt_id must be present",
    },
  ),
});

export const MessageEnvelopeSchema = z.object({
  message_id: z.string(),
  sender_domain: z.string(),
  sender_domain_id: z.string().optional(),
  category: z.literal("message"),
  sent_at: z.coerce.date(),
  message: z.object({
    content_rating: z.string(),
    subject: z.string(),
    body: z.object({
      content_type: z.string(),
      content: z.string(),
    }),
  }),
  metadata: MessageMetadataSchema.optional(),
});

const ReceiptObjectSchema = z.object({
  id: z.string(),
  secret: z.string(),
  category: z.string(),
  max_content_rating: z.string().optional(),
  usage_policy: z.string().optional(),
  issued_at: z.coerce.date(),
}).catchall(z.unknown());

export const ReceiptCallbackEnvelopeSchema = z.object({
  category: z.literal("receipt"),
  invitation_id: z.string(),
  decision: z.enum(["accepted", "rejected"]),
  receipt: ReceiptObjectSchema.optional(),
  reason: z.string().optional(),
}).superRefine((d, ctx) => {
  if (d.decision === "accepted" && d.receipt === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "receipt is required when decision is 'accepted'",
    });
  }
  if (d.decision === "rejected" && d.receipt !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "receipt must not be present when decision is 'rejected'",
    });
  }
});

export const SubmitMessageEnvelopeSchema = z.discriminatedUnion("category", [
  InvitationEnvelopeSchema,
  MessageEnvelopeSchema,
]);

export type InvitationEnvelope = z.infer<typeof InvitationEnvelopeSchema>;
export type MessageEnvelope = z.infer<typeof MessageEnvelopeSchema>;
export type SubmitMessageEnvelope = z.infer<typeof SubmitMessageEnvelopeSchema>;
export type ReceiptCallbackEnvelope = z.infer<
  typeof ReceiptCallbackEnvelopeSchema
>;

export interface HandlerContext {
  bodyBytes: Uint8Array;
  receiptId?: string;
  signature?: string;
  timestamp?: string;
}

export interface MessageHandler {
  readonly category: string;
  handle(
    body: SubmitMessageEnvelope,
    context: HandlerContext,
  ): Promise<{ messageId: string }>;
}

export class InvitationMessageHandler implements MessageHandler {
  readonly category = "invitation";

  constructor(
    private readonly kv: KvService,
    private readonly invitationManager: InvitationManager,
    private readonly receptivePolicyManager: ReceptivePolicyManager,
    private readonly receiptManager: ReceiptManager,
  ) {}

  async handle(
    body: SubmitMessageEnvelope,
    _context: HandlerContext,
  ): Promise<{ messageId: string }> {
    const { invitation } = body as InvitationEnvelope;

    let receiverOid: string;

    if (invitation.receipt_id) {
      // Receipt-path: look up the receipt and verify the receipt-mode policy.
      const receipt = await this.receiptManager.get(invitation.receipt_id);
      if (!receipt || receipt.status !== "active") {
        throw new ReceiptNotActiveError(invitation.receipt_id);
      }
      const receiptPolicy = await this.receptivePolicyManager
        .findActiveReceiptPolicy(receipt.oid, invitation.receipt_id);
      if (!receiptPolicy) {
        throw new ReceptivePolicyNotFoundError(invitation.receipt_id);
      }
      receiverOid = receipt.oid;
    } else {
      // Policy-path: standard receptive_policy_id flow, or shortcode resolution.
      let policyId = invitation.receptive_policy_id;
      if (!policyId && invitation.shortcode) {
        const byShortcode = await this.receptivePolicyManager.getByShortcode(
          invitation.shortcode,
        );
        if (!byShortcode) {
          throw new ReceptivePolicyNotFoundError(invitation.shortcode);
        }
        policyId = byShortcode.policy_id;
      }
      const policy = await this.receptivePolicyManager.getById(policyId!);
      if (!policy) {
        throw new ReceptivePolicyNotFoundError(policyId!);
      }
      if (
        policy.receptive_until && policy.receptive_until < new Date()
      ) {
        throw new ReceptivePolicyExpiredError(policy.policy_id);
      }
      // Closed-mode: explicitly reject all senders.
      if (policy.mode === "closed") {
        throw new ReceptivePolicyClosedError(policy.policy_id);
      }
      // Contact-mode check: verify (sender_domain, domain_id) pair is in contacts.
      if (policy.mode === "contact") {
        const senderDomainId = invitation.claims?.immutable?.["domain_id"];
        const senderDomain = (body as InvitationEnvelope).sender_domain;
        const allowed = typeof senderDomainId === "string" &&
          policy.contacts?.some(
            (c) =>
              c.domain_id === senderDomainId &&
              c.domain.toLowerCase() === senderDomain.toLowerCase(),
          );
        if (!allowed) {
          throw new ReceptivePolicyClosedError(policy.policy_id);
        }
      }
      receiverOid = policy.oid;
    }

    // Store the raw message.
    const messageId = generateUUIDv7();
    await this.kv.store.set(["messages", messageId], body);

    await this.invitationManager.createInvitation(
      invitation.invitation_id,
      receiverOid,
      body.sender_domain,
      invitation.proposed_terms,
      invitation.claims,
      invitation.expires_at,
      messageId,
      invitation.delivery,
    );

    return { messageId: invitation.invitation_id };
  }
}

export class ReceiptMessageHandler implements MessageHandler {
  readonly category = "message";

  constructor(
    private readonly kv: KvService,
    private readonly messageManager: MessageManager,
  ) {}

  async handle(
    body: SubmitMessageEnvelope,
    context: HandlerContext,
  ): Promise<{ messageId: string }> {
    // This handler is responsible for receipt-based HMAC authentication
    const { bodyBytes, receiptId, signature, timestamp } = context;

    if (!receiptId) {
      throw new MissingReceiptIdError();
    }

    if (!signature) {
      throw new MissingSignatureError();
    }

    if (!timestamp) {
      throw new MissingTimestampError();
    }

    // Timestamp freshness check (RFC §5.1.1): must be within ±60 seconds.
    const requestTime = new Date(timestamp).getTime();
    if (isNaN(requestTime)) {
      throw new MissingTimestampError();
    }
    const diffSeconds = Math.abs(Date.now() - requestTime) / 1000;
    if (diffSeconds > 60) {
      throw new RequestStaleError(Math.round(diffSeconds));
    }

    // Verify HMAC signature
    const receiptEntry = await this.kv.store.get(["receipts", receiptId]);
    if (!receiptEntry.value) {
      throw new ReceiptNotFoundError(receiptId);
    }

    const receipt = receiptEntry.value as {
      secret: string;
      status?: string;
      oid?: string;
      category?: string;
    };
    if (receipt.status === "revoked") {
      throw new ReceiptRevokedError(receiptId);
    }
    if (receipt.status === "expired") {
      throw new ReceiptExpiredError(receiptId);
    }

    const isValid = await this.verifyHmac(
      receipt.secret,
      timestamp,
      bodyBytes,
      signature,
    );

    if (!isValid) {
      throw new ReceiptInvalidSignatureError();
    }

    const stored = await this.messageManager.store(
      receipt.oid ?? generateUUIDv7(),
      receiptId,
      (receipt.category ?? "correspondence") as MessageCategory,
      body as MessageEnvelope,
    );

    return { messageId: stored.id };
  }

  private async verifyHmac(
    secret: string,
    timestamp: string,
    bodyBytes: Uint8Array,
    presentedSignature: string,
  ): Promise<boolean> {
    const key = new TextEncoder().encode(secret);
    const data = new TextEncoder().encode(`${timestamp}.`);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const combined = new Uint8Array(data.length + bodyBytes.length);
    combined.set(data, 0);
    combined.set(bodyBytes, data.length);

    const computedSignature = await crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      combined,
    );

    const computedHex = encodeHex(new Uint8Array(computedSignature));

    return computedHex === presentedSignature.toLowerCase();
  }
}

export class ReceiptCallbackHandler {
  constructor(private readonly kv: KvService) {}

  async handle(
    envelope: ReceiptCallbackEnvelope,
  ): Promise<{ messageId: string }> {
    const { invitation_id, decision, receipt } = envelope;

    // Look up invitation to check status
    const entry = await this.kv.store.get(["invitations", invitation_id]);
    if (!entry.value) {
      throw new InvitationNotFoundError(invitation_id);
    }

    const invitation = entry.value as {
      status: string;
      [key: string]: unknown;
    };

    if (invitation.status !== "pending") {
      throw new InvitationNotPendingError(invitation_id, invitation.status);
    }

    // Transition invitation state
    const updated = {
      ...invitation,
      status: decision,
      ...(decision === "accepted" && receipt && { receipt }),
    };
    await this.kv.store.set(["invitations", invitation_id], updated);

    return { messageId: invitation_id };
  }

  async verifyHmac(
    secret: string,
    timestamp: string,
    bodyBytes: Uint8Array,
    presentedSignature: string,
  ): Promise<boolean> {
    const key = new TextEncoder().encode(secret);
    const data = new TextEncoder().encode(`${timestamp}.`);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const combined = new Uint8Array(data.length + bodyBytes.length);
    combined.set(data, 0);
    combined.set(bodyBytes, data.length);

    const computedSignature = await crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      combined,
    );

    const computedHex = encodeHex(new Uint8Array(computedSignature));

    return computedHex === presentedSignature.toLowerCase();
  }
}
