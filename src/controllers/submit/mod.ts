import {
  Controller,
  type GroveApp,
  type IContext,
  type IState,
} from "@justinmchase/grove";
import type { KvService } from "../../services/kv/kv.service.ts";
import type { InvitationManager, ReceptivePolicyManager } from "../../managers/mod.ts";
import {
  DuplicateMessageError,
  InvalidMessageEnvelopeError,
  InvalidRequestBodyError,
  MessageTooLargeError,
} from "./submit.error.ts";
import {
  type HandlerContext,
  type MessageHandler,
  type SubmitMessageEnvelope,
  InvitationMessageHandler,
  ReceiptMessageHandler,
  SubmitMessageEnvelopeSchema,
} from "./message-handler.ts";

export class SubmitController extends Controller {
  private readonly handlers: Map<string, MessageHandler>;

  constructor(
    private readonly kv: KvService,
    private readonly invitationManager: InvitationManager,
    private readonly receptivePolicyManager: ReceptivePolicyManager,
  ) {
    super();

    // Build handler registry by category
    const invitationHandler: MessageHandler = new InvitationMessageHandler(
      this.kv,
      this.invitationManager,
      this.receptivePolicyManager,
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

      // Dispatch to handler based on category
      // Each handler is responsible for its own authentication/validation
      const handler = this.handlers.get(body.category);
      if (!handler) {
        throw new InvalidMessageEnvelopeError(
          `Unsupported message category: ${body.category}`,
        );
      }

      const handlerContext: HandlerContext = {
        bodyBytes: new Uint8Array(bodyBytes),
        receiptId: ctx.req.header("x-rpp-receipt-id"),
        signature: ctx.req.header("x-rpp-signature"),
        timestamp: ctx.req.header("x-rpp-timestamp"),
      };

      // Message ID deduplication (RFC §5.1.1): reject replays within 65-second window.
      const dedupKey = ["dedup", body.sender_domain, body.message_id];
      const existing = await this.kv.store.get(dedupKey);
      if (existing.value !== null) {
        throw new DuplicateMessageError(body.message_id);
      }
      await this.kv.store.set(dedupKey, true, { expireIn: 65_000 });

      const result = await handler.handle(body, handlerContext);

      return ctx.json(
        { ok: true, accepted: true, message_id: result.messageId },
        202,
      );
    });
  }
}
