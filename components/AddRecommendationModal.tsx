"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api";
import { ALLOWED_GENRES, GENRE_LABELS, type Genre } from "@/lib/roles";
import { validateUrl } from "@/lib/validateUrl";
import { VALIDATION, ERROR_MESSAGES } from "@/lib/validation";

interface AddRecommendationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddRecommendationModal({ isOpen, onClose }: AddRecommendationModalProps) {
  const addRecommendation = useMutation(api.recommendations.addRecommendation);

  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState<Genre>("action");
  const [link, setLink] = useState("");
  const [blurb, setBlurb] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Refs for focus management
  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Store the element that triggered the modal
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      // Focus the first input after modal animation
      setTimeout(() => {
        firstInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Restore focus when modal closes
  useEffect(() => {
    if (!isOpen && previousActiveElement.current) {
      previousActiveElement.current.focus();
    }
  }, [isOpen]);

  // Trap focus within modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
        return;
      }

      if (e.key !== "Tab") return;

      const focusableElements = modalRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      if (!focusableElements || focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const validate = useCallback((): string | null => {
    if (title.trim().length === 0) return ERROR_MESSAGES.TITLE_REQUIRED;
    if (title.length > VALIDATION.TITLE_MAX) return ERROR_MESSAGES.TITLE_TOO_LONG;
    if (link.trim().length === 0) return ERROR_MESSAGES.LINK_REQUIRED;
    if (link.length > VALIDATION.LINK_MAX) return ERROR_MESSAGES.LINK_TOO_LONG;
    if (!validateUrl(link)) return ERROR_MESSAGES.LINK_INVALID;
    if (blurb.trim().length === 0) return ERROR_MESSAGES.BLURB_REQUIRED;
    if (blurb.length > VALIDATION.BLURB_MAX) return ERROR_MESSAGES.BLURB_TOO_LONG;
    return null;
  }, [title, link, blurb]);

  const resetForm = useCallback(() => {
    setTitle("");
    setGenre("action");
    setLink("");
    setBlurb("");
    setError(null);
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      await addRecommendation({
        title: title.trim(),
        genre,
        link: link.trim(),
        blurb: blurb.trim(),
      });
      resetForm();
      onClose();
    } catch (err) {
      if (err instanceof ConvexError) {
        setError(err.message);
      } else if (err instanceof Error && err.message.includes("rate")) {
        setError(ERROR_MESSAGES.RATE_LIMITED);
      } else {
        setError(ERROR_MESSAGES.UNKNOWN);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [title, genre, link, blurb, validate, resetForm, onClose, addRecommendation]);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal content */}
      <div
        ref={modalRef}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 id="modal-title" className="text-lg font-semibold text-gray-900">
            Add recommendation
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4"
          >
            <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              ref={firstInputRef}
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={VALIDATION.TITLE_MAX}
              placeholder="e.g. Arrival (2016)"
              required
              aria-describedby="title-hint"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />
            <p id="title-hint" className="text-xs text-gray-400 mt-1">
              {title.length}/{VALIDATION.TITLE_MAX} characters
            </p>
          </div>

          <div>
            <label htmlFor="genre" className="block text-sm font-medium text-gray-700 mb-1">
              Genre
            </label>
            <select
              id="genre"
              value={genre}
              onChange={(e) => setGenre(e.target.value as Genre)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 bg-white"
            >
              {ALLOWED_GENRES.map((g) => (
                <option key={g} value={g}>{GENRE_LABELS[g]}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="link" className="block text-sm font-medium text-gray-700 mb-1">
              Link
            </label>
            <input
              id="link"
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              maxLength={VALIDATION.LINK_MAX}
              placeholder="https://www.imdb.com/title/..."
              required
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />
          </div>

          <div>
            <label htmlFor="blurb" className="block text-sm font-medium text-gray-700 mb-1">
              Why you recommend it
            </label>
            <textarea
              id="blurb"
              value={blurb}
              onChange={(e) => setBlurb(e.target.value)}
              maxLength={VALIDATION.BLURB_MAX}
              rows={3}
              placeholder="What makes this worth watching..."
              required
              aria-describedby="blurb-hint"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none"
            />
            <p id="blurb-hint" className="text-xs text-gray-400 mt-1">
              {blurb.length}/{VALIDATION.BLURB_MAX} characters
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
            >
              {isSubmitting && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {isSubmitting ? "Adding..." : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
