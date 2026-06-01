// Scenario: .github/scenarios/invitations/cancel-pending-invitation.scenario.md
//
// Justin invites Alice via her shortcode, then cancels the invitation before
// she can act on it. Alice's subsequent accept attempt must fail.

import { assert, assertEquals, assertRejects } from "@std/assert";
import { PersonaCallError } from "../../../scripts/dev/persona-client.ts";
import { withScenarioServer } from "../helpers/with-scenario-server.ts";

interface OpenWindowResult {
  shortcode: string;
}

interface SendInvitationResult {
  invitation_id: string;
}

interface InvitationListing {
  invitations: Array<{ invitation_id: string; status: string }>;
}

interface CancelResult {
  invitation_id: string;
  status: string;
}

Deno.test("scenario:cancel-invitation-001 - Cancel a pending invitation prevents acceptance", async (t) => {
  await withScenarioServer(async ({ persona, port }) => {
    const alice = await persona("alice");
    const justin = await persona("justin");
    const localDomain = `localhost:${port}`;

    let shortcode = "";
    let invitationId = "";

    await t.step("alice opens a receptive window", async () => {
      const w = await alice.call<OpenWindowResult>("open_receptive_window", {
        duration_seconds: 120,
      });
      shortcode = w.shortcode;
    });

    await t.step("justin sends an invitation", async () => {
      const r = await justin.call<SendInvitationResult>("send_invitation", {
        receiver_domain: localDomain,
        shortcode,
        communication_terms: {
          categories: ["correspondence"],
          max_content_rating: "G",
        },
      });
      invitationId = r.invitation_id;
    });

    await t.step("justin cancels the invitation", async () => {
      const c = await justin.call<CancelResult>("cancel_invitation", {
        invitation_id: invitationId,
      });
      assertEquals(c.status, "cancelled");
    });

    await t.step("invitation appears in justin's cancelled list", async () => {
      const list = await justin.call<InvitationListing>(
        "list_sent_invitations",
        { status: "cancelled" },
      );
      const found = list.invitations.find((i) =>
        i.invitation_id === invitationId
      );
      assert(found, "cancelled invitation should be in justin's sent list");
    });

    await t.step("alice cannot accept the cancelled invitation", async () => {
      await assertRejects(
        () =>
          alice.call("accept_invitation", {
            invitation_id: invitationId,
            local_terms: {
              categories: ["correspondence"],
              max_content_rating: "G",
            },
          }),
        PersonaCallError,
      );
    });
  });
});
