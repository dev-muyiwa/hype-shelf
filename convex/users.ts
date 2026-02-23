import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Upserts a user record from a Clerk webhook event.
 *
 * Called exclusively from the /api/webhooks/clerk route handler after
 * the svix signature has been verified. Does not require user auth
 * because the caller is our own server code, not a browser client.
 *
 * Role comes from Clerk's publicMetadata (set manually in the Clerk
 * dashboard), never from user-controlled input.
 */
export const upsertUser = mutation({
  args: {
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("user")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        email: args.email,
        role: args.role,
      });
    } else {
      await ctx.db.insert("users", {
        clerkId: args.clerkId,
        name: args.name,
        email: args.email,
        role: args.role,
      });
    }
  },
});

/**
 * Ensures a user record exists for the authenticated user.
 *
 * This is a fallback for when the Clerk webhook hasn't fired yet
 * (e.g., local development without ngrok, or webhook failures).
 * Creates a new user with default "user" role if they don't exist.
 *
 * Returns the user's role.
 */
export const ensureUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Not authenticated");
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (existing) {
      return existing.role;
    }

    // Create user with default role - webhook will update if needed
    const name = identity.name ?? identity.email ?? "Anonymous";
    const email = identity.email ?? "";

    await ctx.db.insert("users", {
      clerkId: identity.subject,
      name: name.slice(0, 100), // Limit length
      email,
      role: "user", // Default role, webhook can upgrade to admin
    });

    return "user" as const;
  },
});

/**
 * Returns the authenticated user's role.
 *
 * Role is resolved from the Convex users table (synced via Clerk webhook),
 * not from user-supplied input. Returns null for unauthenticated callers.
 */
export const getUserRole = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    return user?.role ?? null;
  },
});
