import type { Role, Genre } from "./roles";

/**
 * Fields returned by the public getLatestRecommendations query.
 * Does not include clerkId, email, or addedBy to prevent internal
 * identifiers from leaking to unauthenticated clients.
 */
export interface PublicRecommendation {
  _id: string;
  title: string;
  genre: Genre | string;
  addedByName: string;
  isStaffPick: boolean;
  createdAt: number;
}

/**
 * Full recommendation record returned to authenticated dashboard users.
 */
export interface DashboardRecommendation {
  _id: string;
  title: string;
  genre: Genre | string;
  link: string;
  blurb: string;
  addedBy: string;
  addedByName: string;
  isStaffPick: boolean;
  createdAt: number;
}

export type { Role, Genre };
