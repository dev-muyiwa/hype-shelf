import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  recommendations: defineTable({
    title: v.string(),
    genre: v.string(),
    link: v.string(),
    blurb: v.string(),
    addedBy: v.string(), // Clerk userId
    addedByName: v.string(), // denormalised display name
    isStaffPick: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_creation", ["createdAt"])
    .index("by_genre", ["genre"]),

  users: defineTable({
    clerkId: v.string(),
    role: v.union(v.literal("admin"), v.literal("user")),
    name: v.string(),
    email: v.string(),
  }).index("by_clerk_id", ["clerkId"]),
});
