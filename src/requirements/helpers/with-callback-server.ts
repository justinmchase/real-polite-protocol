export interface CapturedCallback {
  headers: Record<string, string>;
  /** Raw body bytes as received — needed for HMAC verification. */
  bodyBytes: Uint8Array;
  body: Record<string, unknown>;
}

/**
 * Starts a minimal HTTP stub on an ephemeral port that records every POST as a
 * CapturedCallback and responds 202.  Calls `run` with the stub's
 * `domain` (host:port) so tests can seed invitations pointing at it.
 */
export async function withCallbackServer(
  run: (
    domain: string,
    getCaptures: () => CapturedCallback[],
  ) => Promise<void>,
): Promise<void> {
  const captures: CapturedCallback[] = [];
  const ac = new AbortController();

  const server = Deno.serve(
    { port: 0, signal: ac.signal, onListen: () => {} },
    async (req) => {
      const bodyBytes = new Uint8Array(await req.arrayBuffer());
      const body = JSON.parse(
        new TextDecoder().decode(bodyBytes),
      ) as Record<string, unknown>;
      const headers: Record<string, string> = {};
      req.headers.forEach((v, k) => {
        headers[k] = v;
      });
      captures.push({ headers, bodyBytes, body });
      return Response.json({ ok: true, accepted: true }, { status: 202 });
    },
  );

  const port = (server.addr as Deno.NetAddr).port;
  const domain = `localhost:${port}`;

  try {
    await run(domain, () => [...captures]);
  } finally {
    ac.abort();
    await server.finished;
  }
}
