// Scenario: .github/scenarios/invitations/pseudonym-invitation.scenario.md
//
// Justin invites Alice using ONLY custom_claims (pseudonym + tagline) — no
// verified user claims. Alice's view of the invitation must expose the
// pseudonym in claims.custom and MUST NOT leak Justin's verified
// name/email in claims.user.

import { assert, assertEquals } from "@std/assert";
import { withScenarioServer } from "../helpers/with-scenario-server.ts";

interface OpenWindowResult {
  shortcode: string;
}

interface SendInvitationResult {
  invitation_id: string;
}

interface InvitationClaims {
  immutable: Record<string, unknown>;
  user?: Record<string, unknown>;
  admin?: Record<string, unknown>;
  custom?: Record<string, unknown>;
}

interface InvitationListing {
  invitations: Array<{
    invitation_id: string;
    claims?: InvitationClaims;
  }>;
}

interface AcceptResult {
  contact_id: string;
  invitation: { status: string };
}

Deno.test("scenario:pseudonym-invite-001 - Send an invitation with only unverified custom claims", async (t) => {
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

    await t.step(
      "justin sends an invitation with custom claims only",
      async () => {
        const r = await justin.call<SendInvitationResult>("send_invitation", {
          receiver_domain: localDomain,
          shortcode,
          communication_terms: {
            categories: ["correspondence"],
            max_content_rating: "G",
          },
          custom_claims: {
            pseudonym: "ShadowFox",
            tagline: "just a friendly stranger",
          },
        });
        invitationId = r.invitation_id;
      },
    );

    await t.step(
      "alice sees the pending invitation with custom claims",
      async () => {
        const list = await alice.call<InvitationListing>("list_invitations", {
          status: "pending",
        });
        const found = list.invitations.find((i) =>
          i.invitation_id === invitationId
        );
        assert(found, "invitation should be in alice's pending list");
        const claims = found.claims;
        assert(claims, "invitation should carry claims");
        assert(
          claims.immutable.domain_id,
          "immutable.domain_id should be present",
        );
        assertEquals(claims.custom?.pseudonym, "ShadowFox");
        assertEquals(claims.custom?.tagline, "just a friendly stranger");
        const userKeys = Object.keys(claims.user ?? {});
        assertEquals(
          userKeys.length,
          0,
          `claims.user should be absent/empty; got keys: ${userKeys.join(",")}`,
        );
        const adminKeys = Object.keys(claims.admin ?? {});
        assertEquals(
          adminKeys.length,
          0,
          "claims.admin should be absent/empty",
        );
      },
    );

    await t.step("alice accepts the invitation", async () => {
      const accept = await alice.call<AcceptResult>("accept_invitation", {
        invitation_id: invitationId,
        local_terms: {
          categories: ["correspondence"],
          max_content_rating: "G",
        },
      });
      assertEquals(accept.invitation.status, "accepted");
      assert(accept.contact_id);
    });
  });
});
