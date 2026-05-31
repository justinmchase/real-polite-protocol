import { assertEquals, assertThrows } from "@std/assert";
import { upcastContact } from "./contact.upcast.ts";

const V0_RECORD = {
  id: "019dd1af-98ca-7539-85eb-99a0b1a222e7",
  owner_oid: "8c946dc0-a255-4757-8b28-52a81072a784",
  domain: "localhost:8000",
  domain_id: "019dd1af-34af-792d-afae-2e1e70a82500",
  fields: {
    name: [
      {
        value: "Justin Chase",
        source: "sender_verified",
        recorded_at: "2026-04-28T01:24:29.846Z",
      },
    ],
  },
  created_at: "2026-04-28T01:23:59.292Z",
  updated_at: "2026-04-28T01:24:29.846Z",
};

Deno.test("upcastContact: v0 record is renamed, defaulted, and blocked", () => {
  const { contact, changed } = upcastContact(V0_RECORD);
  assertEquals(changed, true);
  assertEquals(contact.id, V0_RECORD.id);
  assertEquals(contact.remote_domain, "localhost:8000");
  assertEquals(contact.remote_domain_id, V0_RECORD.domain_id);
  assertEquals(contact.blocked, true);
  assertEquals(contact.local_terms.max_content_rating, "G");
  assertEquals(contact.remote_terms.categories, ["correspondence"]);
  // credentials are present but synthetic
  assertEquals(typeof contact.local_credential.contact_id, "string");
  assertEquals(typeof contact.remote_credential.contact_secret, "string");
  // field history is preserved
  assertEquals(contact.fields.name?.[0]?.value, "Justin Chase");
  // dates are coerced
  assertEquals(contact.created_at instanceof Date, true);
});

Deno.test("upcastContact: v1 record is returned unchanged", () => {
  const { contact: v1 } = upcastContact(V0_RECORD);
  const result = upcastContact(v1);
  assertEquals(result.changed, false);
  assertEquals(result.contact.id, v1.id);
});

Deno.test("upcastContact: rejects non-object input", () => {
  assertThrows(() => upcastContact(null), TypeError);
  assertThrows(() => upcastContact("nope"), TypeError);
});
