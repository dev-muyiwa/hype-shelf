import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Route protection via Clerk middleware (Rule 9).
 *
 * clerkMiddleware() does NOT protect routes by default — protection must
 * be explicitly configured. We protect /dashboard and all sub-routes.
 * Unauthenticated requests to /dashboard are redirected to Clerk's
 * sign-in page automatically via auth.protect().
 */
const isProtectedRoute = createRouteMatcher(["/dashboard(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
