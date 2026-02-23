/**
 * Role constants and Genre type definitions.
 *
 * Centralising these here prevents magic strings from being scattered
 * across the codebase. Mutations import ALLOWED_GENRES to perform
 * server-side genre validation.
 */

export type Role = "admin" | "user";

export const ROLES = {
  ADMIN: "admin" as Role,
  USER: "user" as Role,
} as const;

export const ALLOWED_GENRES = [
  "horror",
  "action",
  "comedy",
  "drama",
  "thriller",
  "sci-fi",
  "other",
] as const;

export type Genre = (typeof ALLOWED_GENRES)[number];

export const GENRE_LABELS: Record<Genre, string> = {
  horror: "Horror",
  action: "Action",
  comedy: "Comedy",
  drama: "Drama",
  thriller: "Thriller",
  "sci-fi": "Sci-Fi",
  other: "Other",
};
