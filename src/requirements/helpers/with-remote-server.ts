export interface CapturedRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  /** Raw body bytes (needed for HMAC verification). */
  bodyBytes: Uint8Array;
  body: unknown;
}

/**
 * Starts a minimal HTTP stub on an ephemeral port that records every request
 * and responds 202. Used to capture envelopes the local server dispatches to a
 * "remote" RPP domain (e.g. invitation send, invitation_reply, send_message).
 */
export async function withRemoteServer(
  run: (
    domain: string,
    getCaptures: () => CapturedRequest[],
  ) => Promise<void>,
): Promise<void> {
  const captures: CapturedRequest[] = [];
  const ac = new AbortController();

  const server = Deno.serve(
    { port: 0, signal: ac.signal, onListen: () => {} },
    async (req) => {
      const bodyBytes = new Uint8Array(await req.arrayBuffer());
      let body: unknown;
      try {
        body = JSON.parse(new TextDecoder().decode(bodyBytes));
      } catch {
        body = undefined;
      }
      const headers: Record<string, string> = {};
      req.headers.forEach((v, k) => {
        headers[k] = v;
      });
      captures.push({
        method: req.method,
        url: req.url,
        headers,
        bodyBytes,
        body,
      });
      return Response.json(
        { ok: true, accepted: true, envelope_id: crypto.randomUUID() },
        { status: 202 },
      );
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
