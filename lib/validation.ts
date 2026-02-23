/**
 * Shared validation constants.
 * Used by both client-side forms and server-side mutations to stay in sync.
 */

export const VALIDATION = {
  TITLE_MAX: 120,
  BLURB_MAX: 500,
  LINK_MAX: 500,
  NAME_MAX: 100,
} as const;

export const ERROR_MESSAGES = {
  TITLE_REQUIRED: "Title is required",
  TITLE_TOO_LONG: `Title must be ${VALIDATION.TITLE_MAX} characters or fewer`,
  BLURB_REQUIRED: "Why you recommend it is required",
  BLURB_TOO_LONG: `Description must be ${VALIDATION.BLURB_MAX} characters or fewer`,
  LINK_REQUIRED: "Link is required",
  LINK_TOO_LONG: `Link must be ${VALIDATION.LINK_MAX} characters or fewer`,
  LINK_INVALID: "Link must be a valid http:// or https:// URL",
  GENRE_INVALID: "Invalid genre",
  UNAUTHENTICATED: "Please sign in to continue",
  FORBIDDEN: "You don't have permission to do this",
  NOT_FOUND: "Recommendation not found",
  RATE_LIMITED: "Too many requests. Please wait a moment.",
  UNKNOWN: "Something went wrong. Please try again.",
} as const;
