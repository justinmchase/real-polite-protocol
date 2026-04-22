/**
 * Content rating registry (Section 7.3 of the RPP specification).
 *
 * Ratings form a strict total order from least to most restrictive.
 * A receipt's max_content_rating defines the highest rating that may be sent.
 */
export const CONTENT_RATINGS = ["G", "PG", "M", "R"] as const;

export type ContentRating = (typeof CONTENT_RATINGS)[number];

/** Ordinal value for comparing ratings. Lower ordinal = less restrictive. */
export const CONTENT_RATING_ORDINALS: Record<ContentRating, number> = {
  G: 0,
  PG: 1,
  M: 2,
  R: 3,
};
