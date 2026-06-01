// Scenario: .github/scenarios/messages/send-and-reply.scenario.md
//
// Alice invites Justin. Justin accepts. Alice sends a message to Justin.
// Justin marks it read and replies with metadata.in_reply_to. Alice sees
// the reply with the in_reply_to chain intact.

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

interface Contact {
  id: string;
  remote_domain: string;
}

interface ListContactsResult {
  contacts: Contact[];
}

interface SendMessageResult {
  message_id: string;
}

interface FieldRecord {
  value?: unknown;
  source?: string;
}

interface StoredMessage {
  message_id: string;
  read: boolean;
  message: { subject?: string };
  metadata?: Record<string, unknown>;
  sender_fields?: Record<string, FieldRecord>;
}

interface ListMessagesResult {
  messages: StoredMessage[];
}

interface MarkReadResult {
  marked: string[];
  already_read: string[];
  not_found: string[];
}

Deno.test("scenario:send-and-reply-001 - Alice sends Justin a message and Justin replies", async (t) => {
  await withScenarioServer(async ({ persona, port }) => {
    const alice = await persona("alice");
    const justin = await persona("justin");
    const localDomain = `localhost:${port}`;

    let justinShortcode = "";
    let invitationId = "";
    let justinContactForAlice = "";
    let aliceContactForJustin = "";
    let originalMessageId = "";
    let replyMessageId = "";

    await t.step("both personas publish verified metadata", async () => {
      await justin.call("set_user_verified_metadata", {});
      await alice.call("set_user_verified_metadata", {});
    });

    await t.step("justin opens a receptive window", async () => {
      const w = await justin.call<OpenWindowResult>("open_receptive_window", {
        duration_seconds: 120,
      });
      justinShortcode = w.shortcode;
    });

    await t.step("alice invites justin", async () => {
      const r = await alice.call<SendInvitationResult>("send_invitation", {
        receiver_domain: localDomain,
        shortcode: justinShortcode,
        communication_terms: {
          categories: ["correspondence"],
          max_content_rating: "G",
        },
        include_user_claims: ["name", "email"],
      });
      invitationId = r.invitation_id;
    });

    await t.step("justin accepts and gets a contact for alice", async () => {
      const accept = await justin.call<AcceptResult>("accept_invitation", {
        invitation_id: invitationId,
        local_terms: {
          categories: ["correspondence"],
          max_content_rating: "G",
        },
      });
      assertEquals(accept.invitation.status, "accepted");
      justinContactForAlice = accept.contact_id;
    });

    await t.step("alice locates her contact for justin", async () => {
      const list = await alice.call<ListContactsResult>("list_contacts", {});
      assert(
        list.contacts.length >= 1,
        "alice should have at least one contact",
      );
      aliceContactForJustin = list.contacts[0].id;
    });

    await t.step("alice sends the original message", async () => {
      const sent = await alice.call<SendMessageResult>("send_message", {
        contact_id: aliceContactForJustin,
        category: "correspondence",
        content_rating: "G",
        subject: "Original message",
        body: {
          content_type: "text/markdown",
          content: "This is the original.",
        },
      });
      originalMessageId = sent.message_id;
    });

    await t.step("justin sees the original message unread", async () => {
      const list = await justin.call<ListMessagesResult>("list_messages", {});
      const found = list.messages.find((m) =>
        m.message_id === originalMessageId
      );
      assert(found, "justin should see the original message");
      assertEquals(found.read, false);
      assertEquals(found.message.subject, "Original message");
      const nameField = found.sender_fields?.name;
      assert(
        nameField && typeof nameField.value === "string" &&
          nameField.value.length > 0,
        "sender_fields.name should carry alice's verified name",
      );
      assertEquals(nameField.source, "sender_verified");
    });

    await t.step("justin marks the original message read", async () => {
      const r = await justin.call<MarkReadResult>("mark_read", {
        message_ids: [originalMessageId],
      });
      assertEquals(r.marked, [originalMessageId]);
    });

    await t.step("justin replies referencing the original", async () => {
      const sent = await justin.call<SendMessageResult>("send_message", {
        contact_id: justinContactForAlice,
        category: "correspondence",
        content_rating: "G",
        subject: "Re: Original message",
        body: {
          content_type: "text/markdown",
          content: "This is the reply.",
        },
        metadata: { in_reply_to: originalMessageId },
      });
      replyMessageId = sent.message_id;
    });

    await t.step(
      "alice sees the reply with in_reply_to preserved",
      async () => {
        const list = await alice.call<ListMessagesResult>("list_messages", {});
        const found = list.messages.find((m) =>
          m.message_id === replyMessageId
        );
        assert(found, "alice should see the reply");
        assertEquals(found.message.subject, "Re: Original message");
        assertEquals(found.metadata?.in_reply_to, originalMessageId);
      },
    );
  });
});
