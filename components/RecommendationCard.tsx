"use client";

import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api";
import { StaffPickBadge } from "./StaffPickBadge";
import { GENRE_LABELS, type Genre } from "@/lib/roles";
import { timeAgo } from "@/lib/timeAgo";
import { ERROR_MESSAGES } from "@/lib/validation";
import type { DashboardRecommendation, Role } from "@/lib/types";
import type { Id } from "@/convex/_generated/dataModel";

interface RecommendationCardProps {
  rec: DashboardRecommendation;
  currentUserId: string;
  role: Role | null;
}

export function RecommendationCard({
  rec,
  currentUserId,
  role,
}: RecommendationCardProps) {
  const deleteRecommendation = useMutation(api.recommendations.deleteRecommendation);
  const markAsStaffPick = useMutation(api.recommendations.markAsStaffPick);

  const [isDeleting, setIsDeleting] = useState(false);
  const [isPicking, setIsPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = rec.addedBy === currentUserId;
  const isAdmin = role === "admin";
  const canDelete = isOwner || isAdmin;

  // Use useCallback to prevent stale closures
  const handleDelete = useCallback(async () => {
    if (!confirm("Delete this recommendation?")) return;
    setIsDeleting(true);
    setError(null);
    try {
      await deleteRecommendation({ id: rec._id as Id<"recommendations"> });
    } catch (err) {
      if (err instanceof ConvexError) {
        setError(err.message);
      } else if (err instanceof Error && err.message.includes("rate")) {
        setError(ERROR_MESSAGES.RATE_LIMITED);
      } else {
        setError(ERROR_MESSAGES.UNKNOWN);
      }
    } finally {
      setIsDeleting(false);
    }
  }, [rec._id, deleteRecommendation]);

  const handleStaffPick = useCallback(async () => {
    setIsPicking(true);
    setError(null);
    try {
      await markAsStaffPick({ id: rec._id as Id<"recommendations"> });
    } catch (err) {
      if (err instanceof ConvexError) {
        setError(err.message);
      } else if (err instanceof Error && err.message.includes("rate")) {
        setError(ERROR_MESSAGES.RATE_LIMITED);
      } else {
        setError(ERROR_MESSAGES.UNKNOWN);
      }
    } finally {
      setIsPicking(false);
    }
  }, [rec._id, markAsStaffPick]);

  const dismissError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <article
      className={`group rounded-2xl border p-5 bg-white transition-all hover:shadow-md ${
        rec.isStaffPick
          ? "border-amber-200 bg-gradient-to-br from-amber-50 to-white shadow-amber-100/50"
          : "border-gray-200 hover:border-gray-300"
      }`}
      aria-labelledby={`rec-title-${rec._id}`}
    >
      {/* Error message */}
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3"
        >
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{error}</span>
          </div>
          <button
            onClick={dismissError}
            className="text-red-400 hover:text-red-600 p-0.5"
            aria-label="Dismiss error"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {/* Title row */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <a
              id={`rec-title-${rec._id}`}
              href={rec.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-base font-semibold text-gray-900 hover:text-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
            >
              {rec.title}
              <svg
                className="inline-block w-3.5 h-3.5 ml-1 opacity-50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
              <span className="sr-only">(opens in new tab)</span>
            </a>
            {rec.isStaffPick && <StaffPickBadge />}
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
            <span className="inline-flex items-center bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full text-xs font-medium">
              {GENRE_LABELS[rec.genre as Genre] ?? rec.genre}
            </span>
            <span className="text-gray-300" aria-hidden="true">•</span>
            <span>by {rec.addedByName}</span>
            <span className="text-gray-300" aria-hidden="true">•</span>
            <time
              className="text-gray-400"
              dateTime={new Date(rec.createdAt).toISOString()}
              suppressHydrationWarning
            >
              {timeAgo(rec.createdAt)}
            </time>
          </div>

          {/* Description - expands on hover */}
          <div className="relative overflow-hidden">
            <p className="text-sm text-gray-600 leading-relaxed max-h-[1.4em] group-hover:max-h-[10em] transition-[max-height] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]">
              {rec.blurb}
            </p>
            {/* Expand indicator */}
            <span
              className="absolute right-0 bottom-0 text-xs text-gray-400 bg-inherit pl-1 group-hover:opacity-0 transition-opacity duration-200"
              aria-hidden="true"
            >
              ···
            </span>
          </div>
        </div>

        {/* Actions */}
        {(isAdmin || canDelete) && (
          <div className="flex flex-col items-end gap-2 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            {isAdmin && !rec.isStaffPick && (
              <button
                onClick={handleStaffPick}
                disabled={isPicking}
                aria-label={`Mark "${rec.title}" as Staff Pick`}
                className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-2.5 py-1.5 rounded-lg disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span>{isPicking ? "Saving..." : "Staff Pick"}</span>
              </button>
            )}
            {canDelete && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                aria-label={`Delete "${rec.title}"`}
                className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-red-600 bg-gray-50 hover:bg-red-50 px-2.5 py-1.5 rounded-lg disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                <span>{isDeleting ? "Deleting..." : "Delete"}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
