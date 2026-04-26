/**
 * Starts a minimal HTTP stub on an ephemeral port that responds with the given
 * status code for every request. Useful for simulating delivery failure.
 */
export async function withFailingCallbackServer(
  responseStatus: number,
  run: (domain: string, getCallCount: () => number) => Promise<void>,
): Promise<void> {
  let callCount = 0;
  const ac = new AbortController();

  const server = Deno.serve(
    { port: 0, signal: ac.signal, onListen: () => {} },
    async (req) => {
      await req.body?.cancel();
      callCount++;
      return new Response(null, { status: responseStatus });
    },
  );

  const port = (server.addr as Deno.NetAddr).port;
  const domain = `localhost:${port}`;

  try {
    await run(domain, () => callCount);
  } finally {
    ac.abort();
    await server.finished;
  }
}
