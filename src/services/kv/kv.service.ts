import type { Logger } from "@justinmchase/grove";

export class KvService {
  private constructor(
    private readonly kv: Deno.Kv,
  ) {}

  static async create(_logger: Logger, kvPath?: string): Promise<KvService> {
    if (kvPath) {
      const lastSeparator = Math.max(
        kvPath.lastIndexOf("/"),
        kvPath.lastIndexOf("\\"),
      );
      if (lastSeparator > 0) {
        const directory = kvPath.slice(0, lastSeparator);
        await Deno.mkdir(directory, { recursive: true });
      }
    }

    const kv = await Deno.openKv(kvPath);
    return new KvService(kv);
  }

  get store(): Deno.Kv {
    return this.kv;
  }

  close(): void {
    this.kv.close();
  }
}
