import {
  Controller,
  type GroveApp,
  type IContext,
  type IState,
} from "@justinmchase/grove";
import { z } from "zod";
import type {
  ContactManager,
  InvitationManager,
  MessageManager,
  ReceptivePolicyManager,
} from "../../managers/mod.ts";
import type { KvService } from "../../services/kv/kv.service.ts";
import { verifyEnvelopeHmac } from "./envelope-hmac.ts";
import {
  InvitationEnvelopeHandler,
  InvitationReplyEnvelopeHandler,
  type MessageEnvelope,
  MessageEnvelopeHandler,
  MessageEnvelopeSchema,
  SubmitEnvelopeSchema,
} from "./message-handler.ts";
import {
  DuplicateEnvelopeError,
  EnvelopeTooLargeError,
  InvalidAuthHeadersError,
  InvalidBodyError,
  InvalidContentTypeError,
  InvalidInvitationEnvelopeError,
  InvalidMessageEnvelopeError,
  InvalidRequestBodyError,
  MissingContactIdError,
  MissingReceptivePolicyIdError,
  MissingSignatureError,
  MissingTimestampError,
  RequestStaleError,
  SignatureInvalidError,
  SubmitContactNotFoundError,
} from "./submit.error.ts";
import {
  InvitationEnvelopeSchema,
  InvitationReplyEnvelopeSchema,
} from "../../models/invitation/invitation.model.ts";

const MAX_ENVELOPE_SIZE = 262144; // 256 KB (spec §8.1.1)
const ALLOWED_CONTENT_TYPES = new Set(["text/markdown", "application/json"]);
const FRESHNESS_WINDOW_SECONDS = 60;
const DEDUP_TTL_MS = 65_000;

/** Maps to the envelope category recognized by the controller. */
type EnvelopeKind = "invitation" | "invitation_reply" | "message";

export class SubmitController extends Controller {
  private readonly invitationHandler: InvitationEnvelopeHandler;
  private readonly invitationReplyHandler: InvitationReplyEnvelopeHandler;
  private readonly messageHandler: MessageEnvelopeHandler;

  constructor(
    private readonly kv: KvService,
    private readonly invitationManager: InvitationManager,
    receptivePolicyManager: ReceptivePolicyManager,
    private readonly contactManager: ContactManager,
    messageManager: MessageManager,
  ) {
    super();
    this.invitationHandler = new InvitationEnvelopeHandler(
      invitationManager,
      receptivePolicyManager,
    );
    this.invitationReplyHandler = new InvitationReplyEnvelopeHandler(
      invitationManager,
      contactManager,
    );
    this.messageHandler = new MessageEnvelopeHandler(
      messageManager,
      contactManager,
    );
  }

  // deno-lint-ignore require-await
  async use<TContext extends IContext, TState extends IState<TContext>>(
    app: GroveApp<TContext, TState>,
  ): Promise<void> {
    app.post("/rpp/v1/envelopes", async (ctx) => {
      const now = new Date();
      const bodyBytes = new Uint8Array(await ctx.req.arrayBuffer());

      if (bodyBytes.length > MAX_ENVELOPE_SIZE) {
        throw new EnvelopeTooLargeError(bodyBytes.length, MAX_ENVELOPE_SIZE);
      }

      let bodyJson: unknown;
      try {
        bodyJson = JSON.parse(new TextDecoder().decode(bodyBytes));
      } catch {
        throw new InvalidRequestBodyError("failed to parse JSON");
      }

      const kind = classifyEnvelope(bodyJson);

      // Parse identity headers (exactly one required, must match kind).
      const contactIdHeader = ctx.req.header("x-rpp-contact-id");
      const policyIdHeader = ctx.req.header("x-rpp-receptive-policy-id");
      const shortcodeHeader = ctx.req.header("x-rpp-shortcode");

      assertSingleIdentityHeader(
        kind,
        contactIdHeader,
        policyIdHeader,
        shortcodeHeader,
      );

      const signatureHeader = ctx.req.header("x-rpp-signature");
      const timestampHeader = ctx.req.header("x-rpp-timestamp");

      // Dispatch
      if (kind === "invitation") {
        const envelope = parseInvitation(bodyJson);
        await this.assertNotDuplicate(
          envelope.sender_domain,
          envelope.invitation_id,
        );
        // Authentication: receptive_policy_id (or shortcode) is the bearer
        // credential (spec §6.1). No HMAC required, but the identity provided
        // in the header MUST match the policy targeted by the envelope.
        const headerPolicy = policyIdHeader;
        const envelopePolicy = envelope.receptive_policy_id;
        if (envelopePolicy && headerPolicy && headerPolicy !== envelopePolicy) {
          throw new InvalidAuthHeadersError(
            "x-rpp-receptive-policy-id does not match invitation.receptive_policy_id",
          );
        }
        if (
          shortcodeHeader && envelope.shortcode &&
          shortcodeHeader !== envelope.shortcode
        ) {
          throw new InvalidAuthHeadersError(
            "x-rpp-shortcode does not match invitation.shortcode",
          );
        }
        if (!envelope.receptive_policy_id && !envelope.shortcode) {
          throw new MissingReceptivePolicyIdError();
        }
        const result = await this.invitationHandler.handle(envelope, now);
        return ctx.json(
          { ok: true, accepted: true, envelope_id: result.envelopeId },
          202,
        );
      }

      if (kind === "invitation_reply") {
        const envelope = parseInvitationReply(bodyJson);
        await this.assertNotDuplicate(
          envelope.sender_domain,
          envelope.invitation_id,
        );

        const timestamp = requireFreshTimestamp(timestampHeader, now);
        if (!signatureHeader) throw new MissingSignatureError();
        const contactId = contactIdHeader!;

        // Resolve HMAC key from the outbound invitation's reply_credential.
        const auth = await this.invitationReplyHandler.resolveAuth(
          envelope.invitation_id,
          contactId,
        );
        const valid = await verifyEnvelopeHmac(
          auth.contactSecret,
          timestamp,
          bodyBytes,
          signatureHeader,
        );
        if (!valid) throw new SignatureInvalidError();

        const result = await this.invitationReplyHandler.handle(envelope, now);
        return ctx.json(
          { ok: true, accepted: true, envelope_id: result.envelopeId },
          202,
        );
      }

      // kind === "message"
      const envelope = parseMessage(bodyJson);
      enforceMessageBody(envelope);
      await this.assertNotDuplicate(
        envelope.sender_domain,
        envelope.message_id,
      );

      const timestamp = requireFreshTimestamp(timestampHeader, now);
      if (!signatureHeader) throw new MissingSignatureError();
      const contactId = contactIdHeader!;

      const contact = await this.contactManager.getByLocalCredentialId(
        contactId,
      );
      if (!contact) throw new SubmitContactNotFoundError(contactId);

      const valid = await verifyEnvelopeHmac(
        contact.local_credential.contact_secret,
        timestamp,
        bodyBytes,
        signatureHeader,
      );
      if (!valid) throw new SignatureInvalidError();

      const result = await this.messageHandler.handle(envelope, contactId, now);
      return ctx.json(
        { ok: true, accepted: true, envelope_id: result.envelopeId },
        202,
      );
    });
  }

  /**
   * Dedup envelopes by `(sender_domain, envelope_id)` for 60s (spec §6.1.1).
   * Records the key on first sight; on duplicate raises `E_DUPLICATE_ENVELOPE`.
   */
  private async assertNotDuplicate(
    senderDomain: string,
    envelopeId: string,
  ): Promise<void> {
    const key: Deno.KvKey = ["dedup", senderDomain.toLowerCase(), envelopeId];
    const existing = await this.kv.store.get(key);
    if (existing.value !== null) {
      throw new DuplicateEnvelopeError(envelopeId);
    }
    await this.kv.store.set(key, true, { expireIn: DEDUP_TTL_MS });
  }
}

// ---------- Helpers ----------

function classifyEnvelope(body: unknown): EnvelopeKind {
  if (typeof body !== "object" || body === null) {
    throw new InvalidRequestBodyError("envelope must be a JSON object");
  }
  const category = (body as Record<string, unknown>)["category"];
  if (category === "invitation") return "invitation";
  if (category === "invitation_reply") return "invitation_reply";
  if (typeof category === "string") return "message";
  throw new InvalidMessageEnvelopeError("envelope missing category");
}

function assertSingleIdentityHeader(
  kind: EnvelopeKind,
  contactId: string | undefined,
  policyId: string | undefined,
  shortcode: string | undefined,
): void {
  const identityCount = (contactId ? 1 : 0) + (policyId ? 1 : 0) +
    (shortcode ? 1 : 0);
  if (identityCount > 1) {
    throw new InvalidAuthHeadersError(
      "multiple identity headers were provided; only one of x-rpp-contact-id, x-rpp-receptive-policy-id, or x-rpp-shortcode is permitted per request",
    );
  }
  if (kind === "invitation") {
    if (!policyId && !shortcode) {
      throw new InvalidAuthHeadersError(
        "x-rpp-receptive-policy-id or x-rpp-shortcode is required for invitation envelopes",
      );
    }
  } else {
    if (!contactId) throw new MissingContactIdError();
  }
}

function requireFreshTimestamp(
  timestamp: string | undefined,
  now: Date,
): string {
  if (!timestamp) throw new MissingTimestampError();
  const t = new Date(timestamp).getTime();
  if (isNaN(t)) throw new MissingTimestampError();
  const diff = Math.abs(now.getTime() - t) / 1000;
  if (diff > FRESHNESS_WINDOW_SECONDS) {
    throw new RequestStaleError(Math.round(diff));
  }
  return timestamp;
}

function parseInvitation(
  body: unknown,
): z.infer<typeof InvitationEnvelopeSchema> {
  const parsed = InvitationEnvelopeSchema.safeParse(body);
  if (!parsed.success) {
    throw new InvalidInvitationEnvelopeError(firstIssueMessage(parsed.error));
  }
  return parsed.data;
}

function parseInvitationReply(
  body: unknown,
): z.infer<typeof InvitationReplyEnvelopeSchema> {
  const parsed = InvitationReplyEnvelopeSchema.safeParse(body);
  if (!parsed.success) {
    throw new InvalidInvitationEnvelopeError(firstIssueMessage(parsed.error));
  }
  return parsed.data;
}

function parseMessage(body: unknown): MessageEnvelope {
  const parsed = MessageEnvelopeSchema.safeParse(body);
  if (!parsed.success) {
    throw new InvalidMessageEnvelopeError(firstIssueMessage(parsed.error));
  }
  // Outer discriminated-union check is performed by classifyEnvelope; the
  // per-envelope schema does the real validation here.
  return parsed.data;
}

function firstIssueMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "invalid payload";
  const path = issue.path.length ? issue.path.join(".") : "body";
  return `${path}: ${issue.message}`;
}

function enforceMessageBody(envelope: MessageEnvelope): void {
  const ct = envelope.body.content_type;
  if (!ALLOWED_CONTENT_TYPES.has(ct)) {
    throw new InvalidContentTypeError(ct);
  }
  if (ct === "application/json") {
    try {
      JSON.parse(envelope.body.content);
    } catch {
      throw new InvalidBodyError("message body content is not valid JSON");
    }
  }
}

// Re-export the union schema for callers that want to inspect raw envelopes.
export { SubmitEnvelopeSchema };
