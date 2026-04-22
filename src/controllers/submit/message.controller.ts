import {
  Controller,
  type GroveApp,
  type IContext,
  type IState,
} from "@justinmchase/grove";
import { z } from "zod";
import type { KvService } from "../../services/kv/kv.service.ts";
import type { InvitationManager } from "../../managers/mod.ts";
import {
  DuplicateMessageError,
  InvalidMessageEnvelopeError,
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
  InvitationMessageHandler,
  type MessageHandler,
  ReceiptMessageHandler,
  type SubmitMessageEnvelope,
} from "./message-handler.ts";

// Discriminator enum for message categories
const MessageCategoryEnum = z.enum(["invitation", "message"]);

const SubmitMessageEnvelopeSchema = z.object({
  message_id: z.string(),
  sender_domain: z.string(),
  category: MessageCategoryEnum,
  content_rating: z.string(),
  sent_at: z.string().datetime(),
  subject: z.string(),
  body: z.object({
    content_type: z.literal("text/markdown"),
    content: z.string(),
  }),
  metadata: z.record(z.string(), z.unknown()),
});

export class SubmitController extends Controller {
  private readonly handlers: Map<string, MessageHandler>;

  constructor(
    private readonly kv: KvService,
    private readonly invitationManager: InvitationManager,
  ) {
    super();

    // Build handler registry by category
    const invitationHandler: MessageHandler = new InvitationMessageHandler(
      this.kv,
      this.invitationManager,
    );
    const receiptHandler: MessageHandler = new ReceiptMessageHandler(this.kv);

    this.handlers = new Map([
      ["invitation", invitationHandler],
      ["message", receiptHandler],
    ]);
  }

  // deno-lint-ignore require-await
  async use<TContext extends IContext, TState extends IState<TContext>>(
    app: GroveApp<TContext, TState>,
  ): Promise<void> {
    app.post("/rpp/v1/messages", async (ctx) => {
      const bodyBytes = await ctx.req.arrayBuffer();
      const MAX_SIZE = 262144; // 256 KB

      if (bodyBytes.byteLength > MAX_SIZE) {
        throw new MessageTooLargeError(bodyBytes.byteLength, MAX_SIZE);
      }

      // Parse request body JSON
      let bodyJson: unknown;
      try {
        const bodyText = new TextDecoder().decode(bodyBytes);
        bodyJson = JSON.parse(bodyText);
      } catch {
        throw new InvalidRequestBodyError("Failed to parse JSON");
      }

      const parsedBody = SubmitMessageEnvelopeSchema.safeParse(bodyJson);
      if (!parsedBody.success) {
        const issue = parsedBody.error.issues[0];
        const path = issue?.path?.length ? issue.path.join(".") : "body";
        throw new InvalidMessageEnvelopeError(
          `${path}: ${issue?.message ?? "invalid payload"}`,
        );
      }

      const body: SubmitMessageEnvelope = parsedBody.data;

      // For non-invitation messages, verify receipt-based HMAC authentication
      if (body.category === "message") {
        const receiptId = ctx.req.header("x-rpp-receipt-id");
        const signature = ctx.req.header("x-rpp-signature");
        const timestamp = ctx.req.header("x-rpp-timestamp");

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
          new Uint8Array(bodyBytes),
          signature,
        );

        if (!isValid) {
          throw new ReceiptInvalidSignatureError();
        }
      }

      // Message ID deduplication (RFC §5.1.1): reject reuse within 60-second window.
      const dedupKey = ["dedup", body.sender_domain, body.message_id];
      const existing = await this.kv.store.get(dedupKey);
      if (existing.value !== null) {
        throw new DuplicateMessageError(body.message_id);
      }
      // Record with 65-second TTL (slightly longer than the freshness window).
      await this.kv.store.set(dedupKey, true, { expireIn: 65_000 });

      // Dispatch to handler based on category
      const handler = this.handlers.get(body.category);
      if (!handler) {
        throw new InvalidMessageEnvelopeError(
          `Unsupported message category: ${body.category}`,
        );
      }

      const result = await handler.handle(body);

      return ctx.json(
        { ok: true, accepted: true, message_id: result.messageId },
        202,
      );
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

    const computedHex = Array.from(new Uint8Array(computedSignature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return computedHex === presentedSignature.toLowerCase();
  }
}
