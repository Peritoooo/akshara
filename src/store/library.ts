import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  seedBookmarks,
  seedCollections,
  seedEntries,
  seedHighlights,
  seedPositions,
  seedSessions,
} from "@/data/seed";
import type {
  Book,
  Bookmark,
  Collection,
  Highlight,
  HighlightColor,
  LibraryEntry,
  ReadingPosition,
  ReadingSession,
  ReadingStatus,
} from "@/types";
import { clearPdfFiles, deletePdfFile } from "@/lib/pdfStore";

interface LibraryState {
  entries: Record<string, LibraryEntry>;
  positions: Record<string, ReadingPosition>;
  collections: Collection[];
  bookmarks: Bookmark[];
  highlights: Highlight[];
  sessions: ReadingSession[];
  customBooks: Book[];
  addToLibrary: (bookId: string, status?: ReadingStatus) => void;
  removeFromLibrary: (bookId: string) => void;
  addCustomBook: (book: Book) => void;
  removeCustomBook: (bookId: string) => void;
  setStatus: (bookId: string, status: ReadingStatus) => void;
  toggleFavorite: (bookId: string) => void;
  markOpened: (bookId: string) => void;
  restartBook: (bookId: string) => void;
  setProgress: (
    bookId: string,
    percent: number,
    location?: string,
    page?: number,
  ) => void;
  setPosition: (
    bookId: string,
    percent: number,
    location?: string,
    page?: number,
  ) => void;
  createCollection: (name: string, description?: string) => string;
  deleteCollection: (collectionId: string) => void;
  toggleCollection: (bookId: string, collectionId: string) => void;
  addBookmark: (bookmark: Omit<Bookmark, "id" | "createdAt">) => void;
  removeBookmark: (bookmarkId: string) => void;
  addHighlight: (
    highlight: Omit<Highlight, "id" | "createdAt"> & {
      color: HighlightColor;
    },
  ) => void;
  updateHighlightNote: (highlightId: string, note: string) => void;
  removeHighlight: (highlightId: string) => void;
  logSession: (bookId: string, minutes: number) => void;
  resetDemo: () => void;
}

const seededEntries = Object.fromEntries(
  seedEntries.map((entry) => [entry.bookId, entry]),
);

const initialData = () => ({
  entries: structuredClone(seededEntries),
  positions: structuredClone(seedPositions),
  collections: structuredClone(seedCollections),
  bookmarks: structuredClone(seedBookmarks),
  highlights: structuredClone(seedHighlights),
  sessions: structuredClone(seedSessions),
  customBooks: [] as Book[],
});

const now = () => new Date().toISOString();

const clamp = (value: number) => Math.min(1, Math.max(0, value));

const newEntry = (bookId: string, status: ReadingStatus): LibraryEntry => ({
  bookId,
  status,
  addedAt: now(),
  lastOpenedAt: status === "reading" ? now() : undefined,
  progress: 0,
  favorite: false,
  collections: [],
});

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set) => ({
      ...initialData(),

      addToLibrary: (bookId, status = "want") =>
        set((state) => {
          if (state.entries[bookId]) return state;
          return {
            entries: {
              ...state.entries,
              [bookId]: newEntry(bookId, status),
            },
          };
        }),

      removeFromLibrary: (bookId) =>
        set((state) => {
          const entries = { ...state.entries };
          delete entries[bookId];
          const positions = { ...state.positions };
          delete positions[bookId];
          return {
            entries,
            positions,
            bookmarks: state.bookmarks.filter((b) => b.bookId !== bookId),
            highlights: state.highlights.filter((h) => h.bookId !== bookId),
          };
        }),

      addCustomBook: (book) =>
        set((state) => ({
          customBooks: [
            book,
            ...state.customBooks.filter((item) => item.id !== book.id),
          ],
          entries: state.entries[book.id]
            ? state.entries
            : {
                ...state.entries,
                [book.id]: newEntry(book.id, "want"),
              },
        })),

      removeCustomBook: (bookId) => {
        set((state) => {
          const entries = { ...state.entries };
          delete entries[bookId];
          const positions = { ...state.positions };
          delete positions[bookId];
          return {
            entries,
            positions,
            customBooks: state.customBooks.filter((book) => book.id !== bookId),
            bookmarks: state.bookmarks.filter((b) => b.bookId !== bookId),
            highlights: state.highlights.filter((h) => h.bookId !== bookId),
          };
        });
        void deletePdfFile(bookId);
      },

      setStatus: (bookId, status) =>
        set((state) => {
          const existing = state.entries[bookId] ?? newEntry(bookId, status);
          const restart = existing.progress >= 1 && status !== "finished";
          const entry: LibraryEntry = {
            ...existing,
            status,
            finishedAt: status === "finished" ? now() : undefined,
            progress: status === "finished" ? 1 : restart ? 0 : existing.progress,
            lastOpenedAt:
              status === "want" ? existing.lastOpenedAt : now(),
          };
          return { entries: { ...state.entries, [bookId]: entry } };
        }),

      toggleFavorite: (bookId) =>
        set((state) => {
          const existing = state.entries[bookId] ?? newEntry(bookId, "want");
          return {
            entries: {
              ...state.entries,
              [bookId]: { ...existing, favorite: !existing.favorite },
            },
          };
        }),

      markOpened: (bookId) =>
        set((state) => {
          const existing = state.entries[bookId];
          if (!existing) {
            return {
              entries: {
                ...state.entries,
                [bookId]: { ...newEntry(bookId, "reading"), lastOpenedAt: now() },
              },
              positions: {
                ...state.positions,
                [bookId]: {
                  bookId,
                  percent: 0,
                  updatedAt: now(),
                },
              },
            };
          }
          return {
            entries: {
              ...state.entries,
              [bookId]: {
                ...existing,
                status:
                  existing.status === "want" && existing.progress === 0
                    ? "reading"
                    : existing.status,
                lastOpenedAt: now(),
              },
            },
          };
        }),

      restartBook: (bookId) =>
        set((state) => {
          const existing = state.entries[bookId] ?? newEntry(bookId, "reading");
          const positions = { ...state.positions };
          delete positions[bookId];
          return {
            entries: {
              ...state.entries,
              [bookId]: {
                ...existing,
                status: "reading",
                progress: 0,
                finishedAt: undefined,
                lastOpenedAt: now(),
              },
            },
            positions,
          };
        }),

      setProgress: (bookId, percent, location, page) =>
        set((state) => {
          const value = clamp(percent);
          const existing = state.entries[bookId] ?? newEntry(bookId, "reading");
          const finished = value >= 0.995;
          const entry: LibraryEntry = {
            ...existing,
            progress: finished ? 1 : value,
            status: finished
              ? "finished"
              : existing.status === "want"
                ? "reading"
                : existing.status,
            lastOpenedAt: now(),
            finishedAt: finished ? (existing.finishedAt ?? now()) : existing.finishedAt,
          };
          return {
            entries: { ...state.entries, [bookId]: entry },
            positions: {
              ...state.positions,
              [bookId]: {
                bookId,
                location: location ?? state.positions[bookId]?.location,
                page: page ?? state.positions[bookId]?.page,
                percent: finished ? 1 : value,
                updatedAt: now(),
              },
            },
          };
        }),

      setPosition: (bookId, percent, location, page) =>
        set((state) => ({
          positions: {
            ...state.positions,
            [bookId]: {
              bookId,
              location: location ?? state.positions[bookId]?.location,
              page: page ?? state.positions[bookId]?.page,
              percent: clamp(percent),
              updatedAt: now(),
            },
          },
        })),

      createCollection: (name, description) => {
        const id = `${name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")}-${Date.now().toString(36)}`;
        set((state) => ({
          collections: [
            ...state.collections,
            { id, name, description, createdAt: now() },
          ],
        }));
        return id;
      },

      deleteCollection: (collectionId) =>
        set((state) => ({
          collections: state.collections.filter((c) => c.id !== collectionId),
          entries: Object.fromEntries(
            Object.entries(state.entries).map(([id, entry]) => [
              id,
              {
                ...entry,
                collections: entry.collections.filter(
                  (id) => id !== collectionId,
                ),
              },
            ]),
          ),
        })),

      toggleCollection: (bookId, collectionId) =>
        set((state) => {
          const existing = state.entries[bookId];
          if (!existing) return state;
          const has = existing.collections.includes(collectionId);
          return {
            entries: {
              ...state.entries,
              [bookId]: {
                ...existing,
                collections: has
                  ? existing.collections.filter((id) => id !== collectionId)
                  : [...existing.collections, collectionId],
              },
            },
          };
        }),

      addBookmark: (bookmark) =>
        set((state) => {
          const duplicate = state.bookmarks.find(
            (b) =>
              b.bookId === bookmark.bookId &&
              ((bookmark.location && b.location === bookmark.location) ||
                (bookmark.page !== undefined && b.page === bookmark.page)),
          );
          if (duplicate) return state;
          return {
            bookmarks: [
              {
                ...bookmark,
                id: crypto.randomUUID(),
                createdAt: now(),
              },
              ...state.bookmarks,
            ],
          };
        }),

      removeBookmark: (bookmarkId) =>
        set((state) => ({
          bookmarks: state.bookmarks.filter((b) => b.id !== bookmarkId),
        })),

      addHighlight: (highlight) =>
        set((state) => {
          const duplicate = state.highlights.find(
            (h) =>
              h.bookId === highlight.bookId &&
              h.cfiRange === highlight.cfiRange &&
              h.text === highlight.text,
          );
          if (duplicate) return state;
          return {
            highlights: [
              {
                ...highlight,
                id: crypto.randomUUID(),
                createdAt: now(),
              },
              ...state.highlights,
            ],
          };
        }),

      updateHighlightNote: (highlightId, note) =>
        set((state) => ({
          highlights: state.highlights.map((h) =>
            h.id === highlightId ? { ...h, note } : h,
          ),
        })),

      removeHighlight: (highlightId) =>
        set((state) => ({
          highlights: state.highlights.filter((h) => h.id !== highlightId),
        })),

      logSession: (bookId, minutes) =>
        set((state) => {
          const rounded = Math.max(1, Math.round(minutes));
          return {
            sessions: [
              ...state.sessions,
              {
                id: crypto.randomUUID(),
                bookId,
                startedAt: now(),
                minutes: rounded,
              },
            ].slice(-1500),
          };
        }),

      resetDemo: () => {
        set(initialData());
        void clearPdfFiles();
      },
    }),
    {
      name: "akshara-library-v1",
      version: 3,
      migrate: (persistedState, version) => {
        const state = persistedState as Partial<LibraryState>;
        if (version < 2 && Array.isArray(state.highlights)) {
          const seeded = new Map(
            seedHighlights.map((highlight) => [highlight.id, highlight]),
          );
          state.highlights = state.highlights.map((highlight) => {
            const original = seeded.get(highlight.id);
            return original && !highlight.cfiRange
              ? { ...highlight, cfiRange: original.cfiRange }
              : highlight;
          });
        }
        if (version < 3) {
          state.customBooks = Array.isArray(state.customBooks)
            ? state.customBooks
            : [];
        }
        return state as LibraryState;
      },
    },
  ),
);
