"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, usePaginatedQuery, useMutation } from "convex/react";
import { useConvexAuth } from "convex/react";
import { useUser, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { AddRecommendationModal } from "@/components/AddRecommendationModal";
import { RecommendationCard } from "@/components/RecommendationCard";
import { GenreFilter } from "@/components/GenreFilter";
import { useDebounce } from "@/lib/hooks";
import type { Genre } from "@/lib/roles";
import type { DashboardRecommendation } from "@/lib/types";

type SortOrder = "newest" | "oldest";
type FilterState = "all" | Genre;

const PAGE_SIZE = 10;

export default function DashboardPage() {
  const { user } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const userId = user?.id;

  // Filter state
  const [genreFilter, setGenreFilter] = useState<FilterState>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [showOnlyMine, setShowOnlyMine] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 300);

  // Derive effective filter - only active when user is logged in
  const effectiveShowOnlyMine = userId ? showOnlyMine : false;

  // Ensure user record exists in Convex (fallback for webhook)
  const ensureUser = useMutation(api.users.ensureUser);
  const hasEnsuredUser = useRef(false);

  useEffect(() => {
    if (isAuthenticated && !hasEnsuredUser.current) {
      hasEnsuredUser.current = true;
      ensureUser().catch(console.error);
    }
  }, [isAuthenticated, ensureUser]);

  const role = useQuery(api.users.getUserRole, isAuthenticated ? {} : "skip");

  // Server-side paginated query with filters
  const {
    results: recs,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.recommendations.getAllRecommendations,
    isAuthenticated
      ? {
          search: debouncedSearch || undefined,
          genre: genreFilter !== "all" ? genreFilter : undefined,
          onlyMine: effectiveShowOnlyMine || undefined,
          sortOrder,
        }
      : "skip",
    { initialNumItems: PAGE_SIZE }
  );

  // Get total count for display
  const countResult = useQuery(
    api.recommendations.getRecommendationsCount,
    isAuthenticated
      ? {
          search: debouncedSearch || undefined,
          genre: genreFilter !== "all" ? genreFilter : undefined,
          onlyMine: effectiveShowOnlyMine || undefined,
        }
      : "skip"
  );

  const isLoading = status === "LoadingFirstPage";
  const canLoadMore = status === "CanLoadMore";
  const isLoadingMore = status === "LoadingMore";
  const hasActiveFilters = searchQuery || effectiveShowOnlyMine || genreFilter !== "all";
  const totalCount = countResult?.total ?? 0;

  const openModal = useCallback(() => setIsModalOpen(true), []);
  const closeModal = useCallback(() => setIsModalOpen(false), []);

  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setShowOnlyMine(false);
    setGenreFilter("all");
  }, []);

  const clearSearch = useCallback(() => setSearchQuery(""), []);

  const toggleShowOnlyMine = useCallback(() => {
    setShowOnlyMine((prev) => !prev);
  }, []);

  const handleLoadMore = useCallback(() => {
    loadMore(PAGE_SIZE);
  }, [loadMore]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 rounded"
            >
              HypeShelf
            </Link>
            {role === "admin" && (
              <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
                Admin
              </span>
            )}
          </div>
          <UserButton />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {/* Title Section */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              Recommendations
            </h1>
            <p className="text-gray-500">
              {isLoading
                ? "Loading..."
                : hasActiveFilters
                  ? `${recs.length} of ${totalCount} ${totalCount === 1 ? "recommendation" : "recommendations"}`
                  : `${totalCount} total`}
            </p>
          </div>
          <button
            onClick={openModal}
            aria-label="Add new recommendation"
            className="flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-gray-900/10 hover:bg-gray-800 hover:shadow-gray-900/20 transition-all focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add New
          </button>
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-6">
          {/* Search */}
          <div className="relative mb-4">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="search"
              placeholder="Search recommendations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search recommendations"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-10 py-2.5 text-sm placeholder:text-gray-400 focus:border-gray-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/5 transition-all"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                aria-label="Clear search"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Filter Row */}
          <div className="flex flex-wrap items-center gap-3">
            <GenreFilter selected={genreFilter} onChange={setGenreFilter} />

            {/* Sort dropdown */}
            <label className="sr-only" htmlFor="sort-order">Sort order</label>
            <select
              id="sort-order"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              className="appearance-none rounded-lg border border-gray-200 bg-white px-4 py-2 pr-8 text-sm text-gray-700 shadow-sm hover:border-gray-300 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 cursor-pointer"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: "right 0.5rem center",
                backgroundRepeat: "no-repeat",
                backgroundSize: "1.5em 1.5em",
              }}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>

            {/* By me toggle */}
            <button
              onClick={toggleShowOnlyMine}
              aria-pressed={showOnlyMine}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-gray-900/10 ${
                showOnlyMine
                  ? "bg-gray-900 text-white shadow-md"
                  : "bg-white border border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              My Picks
            </button>

            {/* Clear filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="ml-auto text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-gray-500 rounded"
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-4" aria-busy="true" aria-label="Loading recommendations">
            {[1, 2, 3].map((i) => (
              <div
                key={`skeleton-${i}`}
                className="h-28 rounded-2xl bg-white border border-gray-200 animate-pulse"
                aria-hidden="true"
              />
            ))}
          </div>
        ) : recs.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-600 font-medium mb-1">
              {hasActiveFilters
                ? "No recommendations match your filters"
                : "No recommendations yet"}
            </p>
            <p className="text-sm text-gray-400 mb-4">
              {hasActiveFilters
                ? "Try adjusting your search or filters"
                : "Be the first to share something great"}
            </p>
            {hasActiveFilters ? (
              <button
                onClick={clearFilters}
                className="text-sm font-medium text-gray-900 hover:underline focus:outline-none focus:ring-2 focus:ring-gray-900 rounded"
              >
                Clear all filters
              </button>
            ) : (
              <button
                onClick={openModal}
                className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Recommendation
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {recs.map((rec) => (
                <RecommendationCard
                  key={rec._id}
                  rec={rec as DashboardRecommendation}
                  currentUserId={userId ?? ""}
                  role={role ?? null}
                />
              ))}
            </div>

            {/* Load More Button */}
            {canLoadMore && (
              <div className="flex justify-center mt-8">
                <button
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="flex items-center gap-2 px-6 py-3 text-sm font-medium rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                >
                  {isLoadingMore ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Loading...
                    </>
                  ) : (
                    <>
                      Load More
                      <span className="text-gray-400">
                        ({recs.length} of {totalCount})
                      </span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* End of list indicator */}
            {status === "Exhausted" && recs.length > 0 && (
              <p className="text-center text-sm text-gray-400 mt-8">
                You&apos;ve seen all {totalCount} recommendations
              </p>
            )}
          </>
        )}
      </main>

      <AddRecommendationModal
        isOpen={isModalOpen}
        onClose={closeModal}
      />
    </div>
  );
}
