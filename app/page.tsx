"use client";

import { useEffect } from "react";
import { SignInButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { GENRE_LABELS, type Genre } from "@/lib/roles";
import { timeAgo } from "@/lib/timeAgo";
import { StaffPickBadge } from "@/components/StaffPickBadge";

export default function HomePage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  const recs = useQuery(api.recommendations.getLatestRecommendations);

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  // Show loading while checking auth or redirecting
  if (isLoading || isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </div>
    );
  }

  const visibleRecs = recs?.data ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-2xl px-4 py-4 flex items-center justify-between">
          <span className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
            HypeShelf
          </span>
          <SignInButton mode="modal">
            <button className="rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 shadow-lg shadow-gray-900/10 cursor-pointer transition-all">
              Sign in
            </button>
          </SignInButton>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Discover what everyone&apos;s watching
          </h1>
          <p className="text-gray-500 text-lg">
            Share your favorite shows, movies, podcasts, and more
          </p>
        </div>

        {recs === undefined ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-white border border-gray-200 animate-pulse" />
            ))}
          </div>
        ) : visibleRecs.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-gray-300 rounded-2xl bg-white">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="text-gray-600 font-medium mb-2">No recommendations yet</p>
            <p className="text-gray-400 text-sm mb-4">Be the first to share something great</p>
            <SignInButton mode="modal">
              <button className="rounded-xl bg-gray-900 px-6 py-3 text-sm font-semibold text-white hover:bg-gray-800 shadow-lg shadow-gray-900/10 cursor-pointer transition-all">
                Sign in to add yours
              </button>
            </SignInButton>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Visible recommendations (max 3 from backend) */}
            {visibleRecs.map((rec) => (
              <div
                key={rec._id}
                className={`rounded-2xl border p-5 bg-white transition-all hover:shadow-md ${
                  rec.isStaffPick
                    ? "border-amber-200 bg-gradient-to-br from-amber-50 to-white"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="font-semibold text-gray-900">{rec.title}</span>
                  {rec.isStaffPick && <StaffPickBadge />}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full text-xs font-medium">
                    {GENRE_LABELS[rec.genre as Genre] ?? rec.genre}
                  </span>
                  <span className="text-gray-300">•</span>
                  <span>{rec.addedByName}</span>
                  <span className="text-gray-300">•</span>
                  <span className="text-gray-400">{timeAgo(rec.createdAt)}</span>
                </div>
              </div>
            ))}

            {/* Sign in CTA */}
            <div className="text-center py-10 border border-dashed border-gray-300 rounded-2xl bg-white">
              <p className="text-gray-600 font-medium mb-4">
                {recs.hasMore
                  ? `+${recs.total - visibleRecs.length} more recommendations waiting for you`
                  : "Want to add your own?"}
              </p>
              <SignInButton mode="modal">
                <button className="rounded-xl bg-gray-900 px-6 py-3 text-sm font-semibold text-white hover:bg-gray-800 shadow-lg shadow-gray-900/10 cursor-pointer transition-all">
                  {recs.hasMore ? "Sign in to see all" : "Sign in to add yours"}
                </button>
              </SignInButton>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
