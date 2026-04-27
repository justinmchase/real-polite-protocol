import {
  Controller,
  type GroveApp,
  type IContext,
  type IState,
} from "@justinmchase/grove";
import { encodeHex } from "@std/encoding/hex";
import type { KvService } from "../../services/kv/kv.service.ts";
import type {
  InvitationManager,
  MessageManager,
  ReceiptManager,
  ReceptivePolicyManager,
} from "../../managers/mod.ts";
import {
  InvitationNotFoundError,
} from "../../managers/invitation/invitation.error.ts";
import {
  DeliveryTokenInvalidError,
  DuplicateMessageError,
  InvalidAuthHeadersError,
  InvalidBodyError,
  InvalidContentTypeError,
  InvalidMessageEnvelopeError,
  InvalidReceiptEnvelopeError,
  InvalidRequestBodyError,
  MessageTooLargeError,
  MissingReceiptIdError,
  MissingSignatureError,
  MissingTimestampError,
  ReceiptInvalidSignatureError,
  ReceiptNotFoundError,
  RequestStaleError,
} from "./submit.error.ts";
import {
  type InvitationEnvelope,
  InvitationMessageHandler,
  type ReceiptCallbackEnvelope,
  ReceiptCallbackEnvelopeSchema,
  ReceiptCallbackHandler,
  ReceiptMessageHandler,
  SubmitMessageEnvelopeSchema,
} from "./message-handler.ts";

const MAX_SIZE = 262144; // 256 KB
const ALLOWED_CONTENT_TYPES = new Set(["text/markdown", "application/json"]);

export class SubmitController extends Controller {
  private readonly invitationHandler: InvitationMessageHandler;
  private readonly messageHandler: ReceiptMessageHandler;
  private readonly callbackHandler: ReceiptCallbackHandler;

  constructor(
    private readonly kv: KvService,
    invitationManager: InvitationManager,
    receptivePolicyManager: ReceptivePolicyManager,
    receiptManager: ReceiptManager,
    messageManager: MessageManager,
  ) {
    super();
    this.invitationHandler = new InvitationMessageHandler(
      kv,
      invitationManager,
      receptivePolicyManager,
      receiptManager,
    );
    this.messageHandler = new ReceiptMessageHandler(kv, messageManager);
    this.callbackHandler = new ReceiptCallbackHandler(kv);
  }

  // deno-lint-ignore require-await
  async use<TContext extends IContext, TState extends IState<TContext>>(
    app: GroveApp<TContext, TState>,
  ): Promise<void> {
    app.post("/rpp/v1/envelopes", async (ctx) => {
      const rawBuffer = await ctx.req.arrayBuffer();
      const bodyBytes = new Uint8Array(rawBuffer);

      // 1. Size check
      if (bodyBytes.length > MAX_SIZE) {
        throw new MessageTooLargeError(bodyBytes.length, MAX_SIZE);
      }

      // 2. Parse JSON
      let bodyJson: unknown;
      try {
        bodyJson = JSON.parse(new TextDecoder().decode(bodyBytes));
      } catch {
        throw new InvalidRequestBodyError("Failed to parse JSON");
      }

      // 3. Exclusive identity headers
      const receiptIdHeader = ctx.req.header("x-rpp-receipt-id");
      const invitationIdHeader = ctx.req.header("x-rpp-invitation-id");
      if (receiptIdHeader && invitationIdHeader) {
        throw new InvalidAuthHeadersError();
      }

      const signature = ctx.req.header("x-rpp-signature");
      const timestamp = ctx.req.header("x-rpp-timestamp");

      // 4. Route by category
      const raw = bodyJson as Record<string, unknown>;
      const category = raw?.category;

      if (category === "receipt") {
        // --- Receipt callback path ---
        const parsed = ReceiptCallbackEnvelopeSchema.safeParse(bodyJson);
        if (!parsed.success) {
          const issue = parsed.error.issues[0];
          throw new InvalidReceiptEnvelopeError(
            issue?.message ?? "invalid receipt envelope",
          );
        }

        const envelope = parsed.data as ReceiptCallbackEnvelope;

        // Auth: verify HMAC using delivery token stored with invitation
        if (!signature) throw new MissingSignatureError();
        if (!timestamp) throw new MissingTimestampError();

        const requestTime = new Date(timestamp).getTime();
        if (isNaN(requestTime)) throw new MissingTimestampError();
        const diffSeconds = Math.abs(Date.now() - requestTime) / 1000;
        if (diffSeconds > 60) {
          throw new RequestStaleError(Math.round(diffSeconds));
        }

        const invEntry = await this.kv.store.get(
          ["invitations", envelope.invitation_id],
        );
        if (!invEntry.value) {
          throw new InvitationNotFoundError(envelope.invitation_id);
        }

        const inv = invEntry.value as {
          delivery?: { token: string };
          status?: string;
        };
        const deliveryToken = inv.delivery?.token;
        if (!deliveryToken) {
          throw new DeliveryTokenInvalidError();
        }

        const isValid = await this.verifyHmac(
          deliveryToken,
          timestamp,
          bodyBytes,
          signature,
        );
        if (!isValid) {
          throw new DeliveryTokenInvalidError();
        }

        // Dispatch (also checks pending state)
        const result = await this.callbackHandler.handle(envelope);
        return ctx.json(
          { ok: true, accepted: true, invitation_id: result.messageId },
          202,
        );
      } else {
        // --- Invitation / message path ---
        const parsed = SubmitMessageEnvelopeSchema.safeParse(bodyJson);
        if (!parsed.success) {
          const issue = parsed.error.issues[0];
          const path = issue?.path?.length ? issue.path.join(".") : "body";
          throw new InvalidMessageEnvelopeError(
            `${path}: ${issue?.message ?? "invalid payload"}`,
          );
        }

        const envelope = parsed.data;

        // Content-type check for message category
        if (envelope.category === "message") {
          const ct = envelope.message.body.content_type;
          if (!ALLOWED_CONTENT_TYPES.has(ct)) {
            throw new InvalidContentTypeError(ct);
          }
        }

        // JSON well-formedness check for application/json message content
        if (
          envelope.category === "message" &&
          envelope.message.body.content_type === "application/json"
        ) {
          try {
            JSON.parse(envelope.message.body.content);
          } catch {
            throw new InvalidBodyError(
              "message body content is not valid JSON",
            );
          }
        }

        // Auth per category
        if (envelope.category === "message") {
          if (!receiptIdHeader) throw new MissingReceiptIdError();
          if (!signature) throw new MissingSignatureError();
          if (!timestamp) throw new MissingTimestampError();

          const requestTime = new Date(timestamp).getTime();
          if (isNaN(requestTime)) throw new MissingTimestampError();
          const diffSeconds = Math.abs(Date.now() - requestTime) / 1000;
          if (diffSeconds > 60) {
            throw new RequestStaleError(Math.round(diffSeconds));
          }

          const receiptEntry = await this.kv.store.get(
            ["receipts", receiptIdHeader],
          );
          if (!receiptEntry.value) {
            throw new ReceiptNotFoundError(receiptIdHeader);
          }

          const receipt = receiptEntry.value as { secret: string };
          const isValid = await this.verifyHmac(
            receipt.secret,
            timestamp,
            bodyBytes,
            signature,
          );
          if (!isValid) throw new ReceiptInvalidSignatureError();
        } else if (envelope.category === "invitation") {
          // Invitation envelopes (both policy-based and receipt-based) require
          // no additional HMAC auth at the transport layer. The InvitationMessageHandler
          // validates the receipt status and policy for receipt-based invitations.
        }

        // Dedup
        if (envelope.category === "message") {
          const dedupKey = [
            "dedup",
            envelope.sender_domain,
            envelope.message_id,
          ];
          const existing = await this.kv.store.get(dedupKey);
          if (existing.value !== null) {
            throw new DuplicateMessageError(envelope.message_id);
          }
          await this.kv.store.set(dedupKey, true, { expireIn: 65_000 });
        } else if (envelope.category === "invitation") {
          const inv = envelope as InvitationEnvelope;
          const invId = inv.invitation.invitation_id;
          const dedupKey = ["dedup", envelope.sender_domain, invId];
          const existing = await this.kv.store.get(dedupKey);
          if (existing.value !== null) {
            throw new DuplicateMessageError(invId);
          }
          await this.kv.store.set(dedupKey, true, { expireIn: 65_000 });
        }

        // Dispatch
        const context = {
          bodyBytes,
          receiptId: receiptIdHeader ?? undefined,
          signature: signature ?? undefined,
          timestamp: timestamp ?? undefined,
        };

        if (envelope.category === "invitation") {
          const result = await this.invitationHandler.handle(envelope, context);
          return ctx.json(
            { ok: true, accepted: true, invitation_id: result.messageId },
            202,
          );
        } else {
          const result = await this.messageHandler.handle(envelope, context);
          return ctx.json(
            { ok: true, accepted: true, message_id: result.messageId },
            202,
          );
        }
      }
    });
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
