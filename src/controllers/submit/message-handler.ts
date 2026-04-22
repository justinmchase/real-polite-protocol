import { z } from "zod";
import type { KvService } from "../../services/kv/kv.service.ts";
import type { InvitationManager, ReceptivePolicyManager } from "../../managers/mod.ts";
import {
  MissingReceiptIdError,
  MissingSignatureError,
  MissingTimestampError,
  ReceiptInvalidSignatureError,
  ReceiptNotFoundError,
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
  z.array(z.union([z.string().max(512), z.number(), z.boolean(), z.null()])).max(20),
]);

const ClaimMapSchema = z.record(z.string().max(64), ClaimValueSchema)
  .refine((v) => Object.keys(v).length <= 20);

export const InvitationEnvelopeSchema = z.object({
  message_id: z.string(),
  sender_domain: z.string(),
  category: z.literal("invitation"),
  sent_at: z.string().datetime(),
  invitation: z.object({
    receptive_policy_id: z.string().uuid(),
    proposed_terms: z.record(z.string(), z.unknown()),
    claims: z.object({
      immutable: ClaimMapSchema,
      user: ClaimMapSchema.optional(),
      admin: ClaimMapSchema.optional(),
      custom: ClaimMapSchema.optional(),
    }).optional(),
    expires_at: z.string().datetime().optional(),
  }),
});

export const MessageEnvelopeSchema = z.object({
  message_id: z.string(),
  sender_domain: z.string(),
  category: z.literal("message"),
  sent_at: z.string().datetime(),
  message: z.object({
    content_rating: z.string(),
    subject: z.string(),
    body: z.object({
      content_type: z.literal("text/markdown"),
      content: z.string(),
    }),
  }),
});

export const SubmitMessageEnvelopeSchema = z.discriminatedUnion("category", [
  InvitationEnvelopeSchema,
  MessageEnvelopeSchema,
]);

export type InvitationEnvelope = z.infer<typeof InvitationEnvelopeSchema>;
export type MessageEnvelope = z.infer<typeof MessageEnvelopeSchema>;
export type SubmitMessageEnvelope = z.infer<typeof SubmitMessageEnvelopeSchema>;

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
  ) {}

  async handle(
    body: SubmitMessageEnvelope,
    _context: HandlerContext,
  ): Promise<{ messageId: string }> {
    const { invitation } = body as InvitationEnvelope;

    const policy = await this.receptivePolicyManager.getById(invitation.receptive_policy_id);
    if (!policy) {
      throw new ReceptivePolicyNotFoundError(invitation.receptive_policy_id);
    }
    if (policy.receptive_until && new Date(policy.receptive_until) < new Date()) {
      throw new ReceptivePolicyExpiredError(invitation.receptive_policy_id);
    }
    if (policy.mode === "closed") {
      throw new ReceptivePolicyClosedError(invitation.receptive_policy_id);
    }

    const receiverOid = policy.oid;

    // Store the raw message.
    const messageId = crypto.randomUUID();
    await this.kv.store.set(["messages", messageId], body);

    await this.invitationManager.createInvitation(
      body.message_id,
      receiverOid,
      body.sender_domain,
      invitation.proposed_terms,
      invitation.claims,
      invitation.expires_at,
      messageId,
    );

    return { messageId };
  }
}

export class ReceiptMessageHandler implements MessageHandler {
  readonly category = "message";

  constructor(private readonly kv: KvService) {}

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

    const receipt = receiptEntry.value as { secret: string };
    const isValid = await this.verifyHmac(
      receipt.secret,
      timestamp,
      bodyBytes,
      signature,
    );

    if (!isValid) {
      throw new ReceiptInvalidSignatureError();
    }

    const messageId = crypto.randomUUID();
    await this.kv.store.set(["messages", messageId], body);

    return { messageId };
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

    const computedSignature = await crypto.subtle.sign("HMAC", cryptoKey, combined);

    const computedHex = Array.from(new Uint8Array(computedSignature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return computedHex === presentedSignature.toLowerCase();
  }
}
