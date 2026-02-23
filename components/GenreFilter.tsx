"use client";

import { ALLOWED_GENRES, GENRE_LABELS, type Genre } from "@/lib/roles";

interface GenreFilterProps {
  selected: Genre | "all";
  onChange: (genre: Genre | "all") => void;
}

export function GenreFilter({ selected, onChange }: GenreFilterProps) {
  return (
    <>
      <label htmlFor="genre-filter" className="sr-only">
        Filter by genre
      </label>
      <select
        id="genre-filter"
        value={selected}
        onChange={(e) => onChange(e.target.value as Genre | "all")}
        className="appearance-none rounded-lg border border-gray-200 bg-white px-4 py-2 pr-8 text-sm text-gray-700 shadow-sm hover:border-gray-300 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 cursor-pointer"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
          backgroundPosition: "right 0.5rem center",
          backgroundRepeat: "no-repeat",
          backgroundSize: "1.5em 1.5em",
        }}
      >
        <option value="all">All Genres</option>
        {ALLOWED_GENRES.map((genre) => (
          <option key={genre} value={genre}>
            {GENRE_LABELS[genre]}
          </option>
        ))}
      </select>
    </>
  );
}
