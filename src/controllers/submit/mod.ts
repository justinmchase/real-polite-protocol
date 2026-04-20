import {
  Controller,
  type GroveApp,
  type IContext,
  type IState,
} from "@justinmchase/grove";
import type { KvService } from "../../services/kv/mod.ts";

export class SubmitController extends Controller {
  constructor(private readonly kv: KvService) {
    super();
  }

  // deno-lint-ignore require-await
  async use<TContext extends IContext, TState extends IState<TContext>>(
    app: GroveApp<TContext, TState>,
  ): Promise<void> {
    const kv = this.kv;

    app.post("/rpp/v1/messages", async (ctx) => {
      const body = await ctx.req.json();
      const messageId = crypto.randomUUID();

      await kv.store.set(["messages", messageId], body);

      return ctx.json({ ok: true, accepted: true, message_id: messageId }, 202);
    });
  }
}
