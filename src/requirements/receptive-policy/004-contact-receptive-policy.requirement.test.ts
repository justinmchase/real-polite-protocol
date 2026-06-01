import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";

const TERMS = {
  categories: ["correspondence"],
  max_content_rating: "PG",
} as const;

async function getDomainId(kv: Deno.Kv, oid: string): Promise<string> {
  const meta = await kv.get<{ immutable_fields?: Record<string, string> }>([
    "accounts",
    "verified_metadata",
    oid,
  ]);
  const did = meta.value?.immutable_fields?.domain_id;
  if (!did) throw new Error(`no domain_id for ${oid}`);
  return did;
}

Deno.test({
  name:
    "req:receptive-policy-004 - Contact-mode receptive policy restricts senders by (domain, domain_id)",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ kvPath, port, callTool }) => {
        const kv = await Deno.openKv(kvPath);
        try {
          const serverHost = `localhost:${port}`;

          const receiverOid = crypto.randomUUID();
          const receiver = await issueToken({
            oid: receiverOid,
            scope: requiredScopes.join(" "),
            name: "Receiver",
          });
          await callTool(receiver, "set_user_verified_metadata");

          const senderOid = crypto.randomUUID();
          const sender = await issueToken({
            oid: senderOid,
            scope: requiredScopes.join(" "),
            name: "Sender",
          });
          await callTool(sender, "set_user_verified_metadata");
          const senderDomainId = await getDomainId(kv, senderOid);

          await t.step(
            "authorized (domain, domain_id) sender can deliver",
            async () => {
              const { result: pol } = await callTool<{ policy_id: string }>(
                receiver,
                "add_receptive_policy",
                {
                  mode: "contact",
                  contacts: [{ domain: serverHost, domain_id: senderDomainId }],
                },
              );
              assertExists(pol);
              const { status, result } = await callTool<
                { invitation_id: string }
              >(
                sender,
                "send_invitation",
                {
                  receiver_domain: serverHost,
                  receptive_policy_id: pol.policy_id,
                  communication_terms: TERMS,
                },
              );
              assertEquals(status, 200);
              assertExists(result);
              assertExists(result.invitation_id);
            },
          );

          await t.step(
            "sender with different domain_id is rejected",
            async () => {
              const { result: pol } = await callTool<{ policy_id: string }>(
                receiver,
                "add_receptive_policy",
                {
                  mode: "contact",
                  contacts: [
                    { domain: serverHost, domain_id: crypto.randomUUID() },
                  ],
                },
              );
              assertExists(pol);
              const { result, body } = await callTool(
                sender,
                "send_invitation",
                {
                  receiver_domain: serverHost,
                  receptive_policy_id: pol.policy_id,
                  communication_terms: TERMS,
                },
              );
              const errorish =
                (result as { ok?: boolean } | undefined)?.ok === false ||
                body.error !== undefined || result === undefined;
              assertEquals(errorish, true);
            },
          );

          await t.step(
            "domain match is case-insensitive (uppercase domain in contacts)",
            async () => {
              const { result: pol } = await callTool<{ policy_id: string }>(
                receiver,
                "add_receptive_policy",
                {
                  mode: "contact",
                  contacts: [{
                    domain: serverHost.toUpperCase(),
                    domain_id: senderDomainId,
                  }],
                },
              );
              assertExists(pol);
              const { result } = await callTool<{ invitation_id: string }>(
                sender,
                "send_invitation",
                {
                  receiver_domain: serverHost,
                  receptive_policy_id: pol.policy_id,
                  communication_terms: TERMS,
                },
              );
              assertExists(result);
              assertExists(result.invitation_id);
            },
          );

          await t.step(
            "same domain_id from a different domain does NOT satisfy",
            async () => {
              const { result: pol } = await callTool<{ policy_id: string }>(
                receiver,
                "add_receptive_policy",
                {
                  mode: "contact",
                  contacts: [{
                    domain: "other.example.test",
                    domain_id: senderDomainId,
                  }],
                },
              );
              assertExists(pol);
              const { result, body } = await callTool(
                sender,
                "send_invitation",
                {
                  receiver_domain: serverHost,
                  receptive_policy_id: pol.policy_id,
                  communication_terms: TERMS,
                },
              );
              const errorish =
                (result as { ok?: boolean } | undefined)?.ok === false ||
                body.error !== undefined || result === undefined;
              assertEquals(errorish, true);
            },
          );

          await t.step(
            "domain_id matching is exact (one-char difference is rejected)",
            async () => {
              const last = senderDomainId[senderDomainId.length - 1];
              const wrong = senderDomainId.slice(0, -1) +
                (last === "a" ? "b" : "a");
              const { result: pol } = await callTool<{ policy_id: string }>(
                receiver,
                "add_receptive_policy",
                {
                  mode: "contact",
                  contacts: [{ domain: serverHost, domain_id: wrong }],
                },
              );
              assertExists(pol);
              const { result, body } = await callTool(
                sender,
                "send_invitation",
                {
                  receiver_domain: serverHost,
                  receptive_policy_id: pol.policy_id,
                  communication_terms: TERMS,
                },
              );
              const errorish =
                (result as { ok?: boolean } | undefined)?.ok === false ||
                body.error !== undefined || result === undefined;
              assertEquals(errorish, true);
            },
          );

          await t.step(
            "contacts list is immutable: replacement policy gets a new policy_id",
            async () => {
              const { result: p1 } = await callTool<{ policy_id: string }>(
                receiver,
                "add_receptive_policy",
                {
                  mode: "contact",
                  contacts: [
                    { domain: serverHost, domain_id: senderDomainId },
                  ],
                },
              );
              assertExists(p1);
              await callTool(receiver, "remove_receptive_policy", {
                policy_id: p1.policy_id,
              });
              const { result: p2 } = await callTool<{ policy_id: string }>(
                receiver,
                "add_receptive_policy",
                {
                  mode: "contact",
                  contacts: [
                    { domain: serverHost, domain_id: senderDomainId },
                  ],
                },
              );
              assertExists(p2);
              assertEquals(p1.policy_id !== p2.policy_id, true);
            },
          );
        } finally {
          kv.close();
        }
      });
    });
  },
});
