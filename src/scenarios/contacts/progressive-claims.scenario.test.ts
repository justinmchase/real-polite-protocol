// Scenario: .github/scenarios/contacts/progressive-claims.scenario.md
//
// Justin invites Alice twice from the same sender domain. The first
// invitation withholds verified identity (custom_claims only); the second
// shares verified name + email. The privacy property: withholding once
// does not bind the sender to never share later — the second invitation's
// claims.user is allowed to populate.

import { assert, assertEquals } from "@std/assert";
import { withScenarioServer } from "../helpers/with-scenario-server.ts";

interface OpenWindowResult {
  shortcode: string;
}

interface SendInvitationResult {
  invitation_id: string;
}

interface AcceptResult {
  contact_id: string;
  invitation: { status: string };
}

interface InvitationClaims {
  immutable: Record<string, unknown>;
  user?: Record<string, unknown>;
  custom?: Record<string, unknown>;
}

interface InvitationListing {
  invitations: Array<{
    invitation_id: string;
    claims?: InvitationClaims;
  }>;
}

Deno.test("scenario:progressive-claims-001 - A later invitation from the same sender extends what the receiver knows", async (t) => {
  await withScenarioServer(async ({ persona, port }) => {
    const alice = await persona("alice");
    const justin = await persona("justin");
    const localDomain = `localhost:${port}`;

    let shortcodeA = "";
    let invitationId1 = "";
    let shortcodeB = "";
    let invitationId2 = "";

    await t.step("alice opens first receptive window", async () => {
      const w = await alice.call<OpenWindowResult>("open_receptive_window", {
        duration_seconds: 300,
      });
      shortcodeA = w.shortcode;
    });

    await t.step(
      "justin sends first invitation with only custom claims",
      async () => {
        const r = await justin.call<SendInvitationResult>("send_invitation", {
          receiver_domain: localDomain,
          shortcode: shortcodeA,
          communication_terms: {
            categories: ["correspondence"],
            max_content_rating: "G",
          },
          custom_claims: { pseudonym: "ShadowFox" },
        });
        invitationId1 = r.invitation_id;
      },
    );

    await t.step("alice accepts the first invitation", async () => {
      const accept = await alice.call<AcceptResult>("accept_invitation", {
        invitation_id: invitationId1,
        local_terms: {
          categories: ["correspondence"],
          max_content_rating: "G",
        },
      });
      assertEquals(accept.invitation.status, "accepted");
    });

    await t.step(
      "first invitation exposes pseudonym only, no verified identity",
      async () => {
        const list = await alice.call<InvitationListing>("list_invitations", {
          status: "accepted",
        });
        const found = list.invitations.find((i) =>
          i.invitation_id === invitationId1
        );
        assert(found, "first invitation should be in accepted list");
        const claims = found.claims;
        assert(claims, "invitation should carry claims");
        assertEquals(claims.custom?.pseudonym, "ShadowFox");
        const userKeys = Object.keys(claims.user ?? {});
        assertEquals(
          userKeys.length,
          0,
          `claims.user should be empty; got: ${userKeys.join(",")}`,
        );
      },
    );

    await t.step("justin publishes verified metadata", async () => {
      await justin.call("set_user_verified_metadata", {});
    });

    await t.step("alice opens second receptive window", async () => {
      const w = await alice.call<OpenWindowResult>("open_receptive_window", {
        duration_seconds: 300,
      });
      shortcodeB = w.shortcode;
    });

    await t.step(
      "justin sends second invitation with verified identity",
      async () => {
        const r = await justin.call<SendInvitationResult>("send_invitation", {
          receiver_domain: localDomain,
          shortcode: shortcodeB,
          communication_terms: {
            categories: ["correspondence"],
            max_content_rating: "G",
          },
          include_user_claims: ["name", "email"],
        });
        invitationId2 = r.invitation_id;
      },
    );

    await t.step("alice accepts the second invitation", async () => {
      const accept = await alice.call<AcceptResult>("accept_invitation", {
        invitation_id: invitationId2,
        local_terms: {
          categories: ["correspondence"],
          max_content_rating: "G",
        },
      });
      assertEquals(accept.invitation.status, "accepted");
    });

    await t.step(
      "second invitation exposes verified name and email",
      async () => {
        const list = await alice.call<InvitationListing>("list_invitations", {
          status: "accepted",
        });
        const found = list.invitations.find((i) =>
          i.invitation_id === invitationId2
        );
        assert(found, "second invitation should be in accepted list");
        assert(
          found.claims?.user?.name,
          "claims.user.name should be populated",
        );
        assert(
          found.claims?.user?.email,
          "claims.user.email should be populated",
        );
      },
    );
  });
});
