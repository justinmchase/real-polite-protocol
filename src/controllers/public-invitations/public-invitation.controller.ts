import {
  Controller,
  type GroveApp,
  type IContext,
  type IState,
} from "@justinmchase/grove";
import { z } from "zod";
import type { PublicInvitationManager } from "../../managers/mod.ts";
import { CONTENT_RATINGS, MESSAGE_CATEGORIES } from "../../models/mod.ts";

const NegotiatedTermsSchema = z.object({
  category: z.enum(MESSAGE_CATEGORIES),
  max_content_rating: z.enum(CONTENT_RATINGS).optional(),
  usage_policy: z.enum(["one-time", "multiple-time", "any-time"]).optional(),
}).passthrough();

const AcceptBodySchema = z.object({
  acceptor_oid: z.string(),
  acceptor_domain: z.string(),
  display_name: z.string().optional(),
  negotiated_terms: NegotiatedTermsSchema.optional(),
});

export class PublicInvitationController extends Controller {
  constructor(
    private readonly publicInvitationManager: PublicInvitationManager,
  ) {
    super();
  }

  // deno-lint-ignore require-await
  async use<TContext extends IContext, TState extends IState<TContext>>(
    app: GroveApp<TContext, TState>,
  ): Promise<void> {
    // Unauthenticated fetch endpoint.
    app.get("/rpp/v1/invitations/:invitation_id", async (ctx) => {
      const invitationId = ctx.req.param("invitation_id");
      const invitation = await this.publicInvitationManager.get(invitationId);
      if (!invitation) {
        return ctx.json(
          { ok: false, error: { code: "E_PUBLIC_INVITATION_NOT_FOUND" } },
          404,
        );
      }
      return ctx.json(invitation);
    });

    // Cross-domain acceptance endpoint.
    app.post("/rpp/v1/invitations/:invitation_id/accept", async (ctx) => {
      const invitationId = ctx.req.param("invitation_id");

      let raw: unknown;
      try {
        raw = await ctx.req.json();
      } catch {
        return ctx.json({ ok: false, error: { code: "E_INVALID_BODY" } }, 400);
      }

      const parseResult = AcceptBodySchema.safeParse(raw);
      if (!parseResult.success) {
        return ctx.json(
          {
            ok: false,
            error: {
              code: "E_INVALID_BODY",
              details: parseResult.error.issues,
            },
          },
          400,
        );
      }

      const { acceptor_oid, acceptor_domain, negotiated_terms } =
        parseResult.data;

      try {
        const { invitation, receipt } =
          await this.publicInvitationManager.accept(
            invitationId,
            acceptor_oid,
            acceptor_domain,
            negotiated_terms,
          );
        return ctx.json({
          invitation_id: invitation.invitation_id,
          receipt_id: receipt.id,
          issued_at: receipt.issued_at,
        });
      } catch (err) {
        const e = err as { statusCode?: number; code?: string; message?: string };
        const status = e.statusCode ?? 400;
        return ctx.json(
          { ok: false, error: { code: e.code ?? "E_UNKNOWN", message: e.message } },
          status as 400 | 403 | 404,
        );
      }
    });
  }
}
