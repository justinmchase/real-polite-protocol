// Scenario: .github/scenarios/contacts/revision-removal.scenario.md
//
// Justin opens a receptive window, Alice sends an invitation, Justin accepts.
// Justin then sets the "nickname" owner_note field three times on the new
// contact (Al, Allie, Aliyah), removes the first-added and third-added
// revisions, and confirms that the second-added revision survives and is
// surfaced as the flat-merged current_fields value.

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

interface ContactFieldRecord {
  value: unknown;
  source: string;
  recorded_at: string;
}

interface ContactView {
  id: string;
  fields: Record<string, ContactFieldRecord[]>;
  current_fields: Record<string, ContactFieldRecord>;
}

Deno.test("scenario:revision-removal-001 - Justin removes the first and third metadata revisions, leaving the second as the current value", async (t) => {
  await withScenarioServer(async ({ persona, port }) => {
    const alice = await persona("alice");
    const justin = await persona("justin");
    const localDomain = `localhost:${port}`;

    let shortcode = "";
    let invitationId = "";
    let contactId = "";
    let recordedAt1 = "";
    let recordedAt2 = "";
    let recordedAt3 = "";

    await t.step("justin opens a receptive window", async () => {
      const w = await justin.call<OpenWindowResult>("open_receptive_window", {
        duration_seconds: 300,
      });
      shortcode = w.shortcode;
    });

    await t.step("alice sends an invitation to justin", async () => {
      const r = await alice.call<SendInvitationResult>("send_invitation", {
        receiver_domain: localDomain,
        shortcode,
        communication_terms: {
          categories: ["correspondence"],
          max_content_rating: "G",
        },
      });
      invitationId = r.invitation_id;
    });

    await t.step("justin accepts the invitation", async () => {
      const accept = await justin.call<AcceptResult>("accept_invitation", {
        invitation_id: invitationId,
        local_terms: {
          categories: ["correspondence"],
          max_content_rating: "G",
        },
      });
      assertEquals(accept.invitation.status, "accepted");
      contactId = accept.contact_id;
    });

    await t.step("justin adds nickname revision 1 (Al)", async () => {
      const c = await justin.call<ContactView>("set_contact_field", {
        contact_id: contactId,
        key: "nickname",
        value: "Al",
      });
      assertEquals(c.fields.nickname[0].value, "Al");
      recordedAt1 = c.fields.nickname[0].recorded_at;
    });

    await t.step("justin adds nickname revision 2 (Allie)", async () => {
      const c = await justin.call<ContactView>("set_contact_field", {
        contact_id: contactId,
        key: "nickname",
        value: "Allie",
      });
      assertEquals(c.fields.nickname[0].value, "Allie");
      recordedAt2 = c.fields.nickname[0].recorded_at;
    });

    await t.step("justin adds nickname revision 3 (Aliyah)", async () => {
      const c = await justin.call<ContactView>("set_contact_field", {
        contact_id: contactId,
        key: "nickname",
        value: "Aliyah",
      });
      assertEquals(c.fields.nickname.length, 3);
      assertEquals(c.fields.nickname.map((r) => r.value), [
        "Aliyah",
        "Allie",
        "Al",
      ]);
      assertEquals(c.current_fields.nickname.value, "Aliyah");
      recordedAt3 = c.fields.nickname[0].recorded_at;
    });

    await t.step("justin removes the first-added revision (Al)", async () => {
      const c = await justin.call<ContactView>(
        "remove_contact_field_revision",
        {
          contact_id: contactId,
          key: "nickname",
          recorded_at: recordedAt1,
        },
      );
      assertEquals(c.fields.nickname.length, 2);
      assertEquals(c.fields.nickname.map((r) => r.value), ["Aliyah", "Allie"]);
      assertEquals(c.current_fields.nickname.value, "Aliyah");
    });

    await t.step(
      "justin removes the third-added revision (Aliyah)",
      async () => {
        const c = await justin.call<ContactView>(
          "remove_contact_field_revision",
          {
            contact_id: contactId,
            key: "nickname",
            recorded_at: recordedAt3,
          },
        );
        assertEquals(c.fields.nickname.length, 1);
        assertEquals(c.fields.nickname[0].value, "Allie");
        assertEquals(c.current_fields.nickname.value, "Allie");
      },
    );

    await t.step(
      "get_contact returns Allie (the second-added revision) as the flat-merged current value",
      async () => {
        const c = await justin.call<ContactView>("get_contact", {
          contact_id: contactId,
        });
        assertEquals(c.fields.nickname.length, 1);
        assertEquals(c.fields.nickname[0].value, "Allie");
        assertEquals(c.fields.nickname[0].recorded_at, recordedAt2);
        assert(c.current_fields.nickname, "current_fields.nickname must exist");
        assertEquals(c.current_fields.nickname.value, "Allie");
      },
    );
  });
});
