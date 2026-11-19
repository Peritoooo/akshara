import type {
  Bookmark,
  Collection,
  Highlight,
  LibraryEntry,
  ReadingPosition,
  ReadingSession,
} from "@/types";

// The shelf starts empty on purpose: this reading room is yours.
// Books only appear here once you import a PDF of your own.

export const seedCollections: Collection[] = [];

export const seedEntries: LibraryEntry[] = [];

export const seedPositions: Record<string, ReadingPosition> = {};

export const seedSessions: ReadingSession[] = [];

export const seedBookmarks: Bookmark[] = [];

export const seedHighlights: Highlight[] = [];

export const seedSettings = {
  theme: "system" as const,
  displayName: "Reader",
  dailyGoal: 30,
  reader: {
    fontSize: 19,
    fontFamily: "literata" as const,
    lineHeight: 1.8,
    margin: 2,
    theme: "follow" as const,
    pdfPages: "theme" as const,
  },
};
