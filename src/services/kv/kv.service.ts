import type { Logger } from "@justinmchase/grove";

export class KvService {
  private constructor(
    private readonly kv: Deno.Kv,
  ) {}

  static async create(_logger: Logger): Promise<KvService> {
    const kv = await Deno.openKv();
    return new KvService(kv);
  }

  get store(): Deno.Kv {
    return this.kv;
  }

  close(): void {
    this.kv.close();
  }
}
