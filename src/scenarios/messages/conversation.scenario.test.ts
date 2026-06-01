// Scenario: .github/scenarios/messages/conversation.scenario.md
//
// Minimal end-to-end conversation: Alice opens a window, Justin invites,
// Alice accepts, Justin sends, Alice replies.

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

interface StoredMessage {
  message_id: string;
  read: boolean;
  message: { subject?: string };
  metadata?: Record<string, unknown>;
}

interface ListMessagesResult {
  messages: StoredMessage[];
}

Deno.test("scenario:conversation-001 - Alice and Justin exchange a message and a reply", async (t) => {
  await withScenarioServer(async ({ persona, port }) => {
    const alice = await persona("alice");
    const justin = await persona("justin");
    const localDomain = `localhost:${port}`;

    let shortcode = "";
    let invitationId = "";
    let aliceContactId = "";
    let justinContactId = "";
    let originalMessageId = "";

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

    await t.step("alice accepts and both sides have a contact", async () => {
      const accept = await alice.call<AcceptResult>("accept_invitation", {
        invitation_id: invitationId,
        local_terms: {
          categories: ["correspondence"],
          max_content_rating: "G",
        },
      });
      assertEquals(accept.invitation.status, "accepted");
      aliceContactId = accept.contact_id;

      const list = await justin.call<ListContactsResult>("list_contacts", {});
      assert(list.contacts.length >= 1, "justin should have a contact");
      justinContactId = list.contacts[0].id;
    });

    await t.step("justin sends a message and alice receives it", async () => {
      const sent = await justin.call<SendMessageResult>("send_message", {
        contact_id: justinContactId,
        category: "correspondence",
        content_rating: "G",
        subject: "Hi Alice",
        body: {
          content_type: "text/markdown",
          content: "Hi Alice, how are you?",
        },
      });
      originalMessageId = sent.message_id;

      const inbox = await alice.call<ListMessagesResult>("list_messages", {});
      const found = inbox.messages.find((m) =>
        m.message_id === originalMessageId
      );
      assert(found, "alice should have received the message");
      assertEquals(found.message.subject, "Hi Alice");
      assertEquals(found.read, false);
    });

    await t.step("alice replies and justin receives the reply", async () => {
      const sent = await alice.call<SendMessageResult>("send_message", {
        contact_id: aliceContactId,
        category: "correspondence",
        content_rating: "G",
        subject: "Re: Hi Alice",
        body: {
          content_type: "text/markdown",
          content: "Hi Justin, doing well!",
        },
        metadata: { in_reply_to: originalMessageId },
      });
      const replyId = sent.message_id;

      const inbox = await justin.call<ListMessagesResult>("list_messages", {});
      const found = inbox.messages.find((m) => m.message_id === replyId);
      assert(found, "justin should have received the reply");
      assertEquals(found.message.subject, "Re: Hi Alice");
      assertEquals(found.metadata?.in_reply_to, originalMessageId);
    });
  });
});
