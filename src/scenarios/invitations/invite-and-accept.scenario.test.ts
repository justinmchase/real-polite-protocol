// Scenario: .github/scenarios/invitations/invite-and-accept.scenario.md
//
// Justin invites Alice (via her shortcode-protected receptive window) and
// Alice accepts. Exercises the full multi-persona invitation flow over the
// real /mcp HTTP endpoint.

import { assert, assertEquals } from "@std/assert";
import { withScenarioServer } from "../helpers/with-scenario-server.ts";

interface OpenWindowResult {
  policy_id: string;
  shortcode: string;
  domain: string;
}

interface SendInvitationResult {
  invitation_id: string;
}

interface InvitationListing {
  invitations: Array<{
    invitation_id: string;
    direction: "inbound" | "outbound";
    status: string;
    message?: string;
  }>;
}

interface AcceptResult {
  contact_id: string;
  invitation: { invitation_id: string; status: string };
}

Deno.test("scenario:invite-and-accept-001 - Justin invites Alice and Alice accepts", async (t) => {
  await withScenarioServer(async ({ persona, port }) => {
    const alice = await persona("alice");
    const justin = await persona("justin");
    const localDomain = `localhost:${port}`;

    let shortcode = "";
    let invitationId = "";

    await t.step("alice opens a receptive window", async () => {
      const window = await alice.call<OpenWindowResult>(
        "open_receptive_window",
        { duration_seconds: 120 },
      );
      assert(window.shortcode, "expected shortcode in window");
      shortcode = window.shortcode;
    });

    await t.step("justin sends an invitation to alice", async () => {
      const result = await justin.call<SendInvitationResult>(
        "send_invitation",
        {
          receiver_domain: localDomain,
          shortcode,
          communication_terms: {
            categories: ["correspondence"],
            max_content_rating: "G",
          },
          message: "hi this is justin",
        },
      );
      assert(result.invitation_id, "expected invitation_id");
      invitationId = result.invitation_id;
    });

    await t.step("alice sees the pending invitation", async () => {
      const list = await alice.call<InvitationListing>("list_invitations", {
        status: "pending",
      });
      const found = list.invitations.find((i) =>
        i.invitation_id === invitationId
      );
      assert(found, "invitation should appear in alice's pending list");
      assertEquals(found.direction, "inbound");
      assertEquals(found.message, "hi this is justin");
    });

    await t.step("alice accepts the invitation", async () => {
      const accept = await alice.call<AcceptResult>("accept_invitation", {
        invitation_id: invitationId,
        local_terms: {
          categories: ["correspondence"],
          max_content_rating: "G",
        },
        message: "hi justin, accepted",
      });
      assertEquals(accept.invitation.status, "accepted");
      assert(accept.contact_id, "expected contact_id from accept_invitation");
    });

    await t.step("justin sees the invitation as accepted", async () => {
      const list = await justin.call<InvitationListing>(
        "list_sent_invitations",
        { status: "accepted" },
      );
      const found = list.invitations.find((i) =>
        i.invitation_id === invitationId
      );
      assert(
        found,
        "invitation should appear in justin's accepted sent list",
      );
      assertEquals(found.status, "accepted");
    });
  });
});
