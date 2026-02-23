import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query, MutationCtx } from "./_generated/server";
import { validateUrl } from "../lib/validateUrl";
import { ALLOWED_GENRES, type Genre } from "../lib/roles";
import { VALIDATION, ERROR_MESSAGES } from "../lib/validation";

/**
 * Helper to resolve a caller's role from the DB using their verified
 * Clerk identity. Role is never taken from user-supplied input.
 */
async function resolveRole(
  ctx: MutationCtx,
  clerkId: string
): Promise<"admin" | "user" | null> {
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
    .unique();
  return user?.role ?? null;
}

/**
 * Simple in-memory rate limit tracker.
 * In production, use Redis or a proper rate limiting service.
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per minute

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  entry.count++;
  return true;
}

/**
 * Sanitizes a display name to prevent XSS and limit length.
 */
function sanitizeName(name: string | undefined | null): string {
  if (!name) return "Anonymous";
  // Trim, limit length, and remove any HTML-like characters
  return name
    .trim()
    .slice(0, VALIDATION.NAME_MAX)
    .replace(/[<>]/g, "");
}

/**
 * Public query — no authentication required.
 *
 * Returns ONLY the 3 most recent recommendations for unauthenticated users.
 * This is a security measure - we don't expose more data than what's visible.
 * Only exposes public-safe fields: internal user IDs, Clerk IDs, and emails
 * are intentionally omitted to prevent sensitive data leaking.
 */
export const getLatestRecommendations = query({
  args: {},
  handler: async (ctx) => {
    // Only return 3 items for public/unauthenticated access
    const PUBLIC_LIMIT = 3;

    const recs = await ctx.db
      .query("recommendations")
      .withIndex("by_creation")
      .order("desc")
      .take(PUBLIC_LIMIT);

    // Get total count efficiently using a separate query
    const allRecs = await ctx.db.query("recommendations").collect();
    const total = allRecs.length;

    return {
      data: recs.map((rec) => ({
        _id: rec._id,
        title: rec.title,
        genre: rec.genre,
        addedByName: rec.addedByName,
        isStaffPick: rec.isStaffPick,
        createdAt: rec.createdAt,
      })),
      total,
      hasMore: total > PUBLIC_LIMIT,
    };
  },
});

/**
 * Authenticated query — returns paginated, filtered, and searchable recommendations.
 * Requires an authenticated Clerk session.
 *
 * All filtering, searching, and pagination happens server-side for efficiency.
 *
 * Args:
 * - paginationOpts: Convex cursor-based pagination options
 * - search: Optional search query (matches title, blurb, author)
 * - genre: Optional genre filter
 * - onlyMine: If true, only return user's own recommendations
 * - sortOrder: "newest" or "oldest"
 *
 * Returns: Convex paginated result with { page, isDone, continueCursor }
 */
export const getAllRecommendations = query({
  args: {
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
    genre: v.optional(v.string()),
    onlyMine: v.optional(v.boolean()),
    sortOrder: v.optional(v.union(v.literal("newest"), v.literal("oldest"))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError(ERROR_MESSAGES.UNAUTHENTICATED);

    const sortOrder = args.sortOrder ?? "newest";
    const searchQuery = args.search?.toLowerCase().trim() ?? "";
    const genreFilter = args.genre;
    const onlyMine = args.onlyMine ?? false;
    const userId = identity.subject;

    // Build the base query with ordering
    let query = ctx.db
      .query("recommendations")
      .withIndex("by_creation")
      .order(sortOrder === "newest" ? "desc" : "asc");

    // Apply filters using Convex's filter method
    // Note: For large datasets, consider adding more indexes
    const filtered = query.filter((q) => {
      const conditions = [];

      // Genre filter
      if (genreFilter && genreFilter !== "all") {
        conditions.push(q.eq(q.field("genre"), genreFilter));
      }

      // Only my recommendations
      if (onlyMine) {
        conditions.push(q.eq(q.field("addedBy"), userId));
      }

      // If no conditions, return true (all records)
      if (conditions.length === 0) {
        return true;
      }

      // AND all conditions together
      return conditions.reduce((acc, cond) => q.and(acc, cond));
    });

    // Paginate the filtered results
    const paginatedResults = await filtered.paginate(args.paginationOpts);

    // Apply search filter in-memory (Convex doesn't support LIKE queries)
    // This is done post-pagination for efficiency on the indexed/filtered data
    let filteredPage = paginatedResults.page;
    if (searchQuery) {
      filteredPage = paginatedResults.page.filter(
        (rec) =>
          rec.title.toLowerCase().includes(searchQuery) ||
          rec.blurb.toLowerCase().includes(searchQuery) ||
          rec.addedByName.toLowerCase().includes(searchQuery)
      );
    }

    return {
      ...paginatedResults,
      page: filteredPage.map((rec) => ({
        ...rec,
        createdAt: rec.createdAt,
      })),
    };
  },
});

/**
 * Get total count of recommendations (for UI display).
 * Optionally filtered by genre, search, or user.
 */
export const getRecommendationsCount = query({
  args: {
    search: v.optional(v.string()),
    genre: v.optional(v.string()),
    onlyMine: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError(ERROR_MESSAGES.UNAUTHENTICATED);

    const searchQuery = args.search?.toLowerCase().trim() ?? "";
    const genreFilter = args.genre;
    const onlyMine = args.onlyMine ?? false;
    const userId = identity.subject;

    let recs = await ctx.db.query("recommendations").collect();

    // Apply filters
    if (genreFilter && genreFilter !== "all") {
      recs = recs.filter((r) => r.genre === genreFilter);
    }

    if (onlyMine) {
      recs = recs.filter((r) => r.addedBy === userId);
    }

    if (searchQuery) {
      recs = recs.filter(
        (r) =>
          r.title.toLowerCase().includes(searchQuery) ||
          r.blurb.toLowerCase().includes(searchQuery) ||
          r.addedByName.toLowerCase().includes(searchQuery)
      );
    }

    return { total: recs.length };
  },
});

/**
 * Adds a new recommendation.
 *
 * Security:
 * - Requires authenticated identity (Rule 3)
 * - All inputs validated server-side (Rules 4 & 5)
 * - addedBy is set from the verified identity token, not client input
 * - isStaffPick is always false on creation; only an admin mutation can set it
 * - Rate limited to prevent spam
 * - User name is sanitized to prevent XSS
 */
export const addRecommendation = mutation({
  args: {
    title: v.string(),
    genre: v.string(),
    link: v.string(),
    blurb: v.string(),
  },
  handler: async (ctx, args) => {
    // Rule 3: Authenticate before acting
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError(ERROR_MESSAGES.UNAUTHENTICATED);

    // Rate limiting
    if (!checkRateLimit(identity.subject)) {
      throw new ConvexError(ERROR_MESSAGES.RATE_LIMITED);
    }

    // Rule 5: Server-side input validation
    const title = args.title.trim();
    const blurb = args.blurb.trim();
    const link = args.link.trim();

    if (title.length === 0) {
      throw new ConvexError(ERROR_MESSAGES.TITLE_REQUIRED);
    }
    if (title.length > VALIDATION.TITLE_MAX) {
      throw new ConvexError(ERROR_MESSAGES.TITLE_TOO_LONG);
    }
    if (blurb.length === 0) {
      throw new ConvexError(ERROR_MESSAGES.BLURB_REQUIRED);
    }
    if (blurb.length > VALIDATION.BLURB_MAX) {
      throw new ConvexError(ERROR_MESSAGES.BLURB_TOO_LONG);
    }
    if (link.length === 0) {
      throw new ConvexError(ERROR_MESSAGES.LINK_REQUIRED);
    }
    if (link.length > VALIDATION.LINK_MAX) {
      throw new ConvexError(ERROR_MESSAGES.LINK_TOO_LONG);
    }

    // Rule 5: Genre must be one of the allowed enum values
    if (!ALLOWED_GENRES.includes(args.genre as Genre)) {
      throw new ConvexError(ERROR_MESSAGES.GENRE_INVALID);
    }

    // Rule 4: URL protocol validation — blocks javascript:, data:, ftp:, etc.
    if (!validateUrl(link)) {
      throw new ConvexError(ERROR_MESSAGES.LINK_INVALID);
    }

    // Sanitize display name to prevent XSS and limit length
    const addedByName = sanitizeName(identity.name ?? identity.email);

    await ctx.db.insert("recommendations", {
      title,
      genre: args.genre,
      link,
      blurb,
      addedBy: identity.subject, // Clerk userId from verified token
      addedByName,
      isStaffPick: false, // always false on creation
      createdAt: Date.now(),
    });
  },
});

/**
 * Deletes a recommendation.
 *
 * Security:
 * - Requires authenticated identity (Rule 3)
 * - Allows deletion only if: caller is the owner OR caller has admin role
 * - Role is resolved from the DB using the verified identity, not client input (Rule 1)
 * - Throws Forbidden for any other caller
 * - Rate limited to prevent abuse
 */
export const deleteRecommendation = mutation({
  args: { id: v.id("recommendations") },
  handler: async (ctx, args) => {
    // Rule 3: Authenticate before acting
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError(ERROR_MESSAGES.UNAUTHENTICATED);

    // Rate limiting
    if (!checkRateLimit(identity.subject)) {
      throw new ConvexError(ERROR_MESSAGES.RATE_LIMITED);
    }

    const rec = await ctx.db.get(args.id);
    if (!rec) throw new ConvexError(ERROR_MESSAGES.NOT_FOUND);

    // Rule 1 & 2: Resolve role from DB, never from client input
    const role = await resolveRole(ctx, identity.subject);

    const isOwner = rec.addedBy === identity.subject;
    const isAdmin = role === "admin";

    if (!isOwner && !isAdmin) {
      throw new ConvexError(ERROR_MESSAGES.FORBIDDEN);
    }

    await ctx.db.delete(args.id);
  },
});

/**
 * Marks a recommendation as the Staff Pick.
 *
 * Security:
 * - Requires admin role (Rule 2)
 * - Role resolved from DB, not client input (Rule 1)
 * - Atomic: unsets any existing Staff Pick in the same handler (Rule 6)
 *   Exactly one Staff Pick may exist at any time, enforced server-side.
 * - Rate limited to prevent abuse
 */
export const markAsStaffPick = mutation({
  args: { id: v.id("recommendations") },
  handler: async (ctx, args) => {
    // Rule 3: Authenticate before acting
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError(ERROR_MESSAGES.UNAUTHENTICATED);

    // Rate limiting
    if (!checkRateLimit(identity.subject)) {
      throw new ConvexError(ERROR_MESSAGES.RATE_LIMITED);
    }

    // Rule 1 & 2: Resolve role from DB
    const role = await resolveRole(ctx, identity.subject);
    if (role !== "admin") {
      throw new ConvexError(ERROR_MESSAGES.FORBIDDEN);
    }

    // Verify target recommendation exists
    const rec = await ctx.db.get(args.id);
    if (!rec) throw new ConvexError(ERROR_MESSAGES.NOT_FOUND);

    // Rule 6: Atomically unset any existing Staff Pick
    const existingPick = await ctx.db
      .query("recommendations")
      .filter((q) => q.eq(q.field("isStaffPick"), true))
      .first();

    if (existingPick && existingPick._id !== args.id) {
      await ctx.db.patch(existingPick._id, { isStaffPick: false });
    }

    // Set the new Staff Pick
    await ctx.db.patch(args.id, { isStaffPick: true });
  },
});
