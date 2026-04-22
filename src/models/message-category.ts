/**
 * Message category registry (Section 7.2 of the RPP specification).
 *
 * Each receipt and message envelope carries exactly one category.
 * The message category MUST match the receipt category.
 */
export const MESSAGE_CATEGORIES = [
  "correspondence",
  "billing",
  "marketing",
  "event",
  "invitation",
  "security",
  "transactional",
  "legal",
  "support",
] as const;

export type MessageCategory = (typeof MESSAGE_CATEGORIES)[number];
