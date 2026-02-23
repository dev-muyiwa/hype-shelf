"use client";

import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { useAuth } from "@clerk/nextjs";

/**
 * Initialised once at module level — ConvexReactClient maintains a
 * persistent WebSocket connection for real-time subscriptions.
 */
const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL as string
);

/**
 * Wraps the app in both the Convex client and Clerk auth context.
 * ConvexProviderWithClerk automatically threads the Clerk JWT into
 * every Convex query and mutation, enabling server-side identity
 * verification via ctx.auth.getUserIdentity().
 */
export function ConvexClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
