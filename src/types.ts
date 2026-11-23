export type ReadingStatus = "reading" | "want" | "finished";

export type BookFormat = "epub" | "pdf";

export type CoverMotif =
  | "arch"
  | "sun"
  | "waves"
  | "botanical"
  | "orbit"
  | "lattice"
  | "peaks"
  | "flame"
  | "feather"
  | "keyhole"
  | "moon"
  | "deco";

export interface CoverPalette {
  bg: string;
  ink: string;
  accent: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  description: string;
  genres: string[];
  year: number;
  pages: number;
  language: string;
  format: BookFormat;
  file: string;
  cover: CoverPalette;
  motif: CoverMotif;
  publisher: string;
  featured?: boolean;
  rating?: number;
  editorial?: string;
  addedAt: string;
  /** A PDF imported from the reader's own device. Stored in IndexedDB. */
  custom?: boolean;
  /** First-page thumbnail (data URL) for imported PDFs. */
  coverImage?: string;
}

export interface LibraryEntry {
  bookId: string;
  status: ReadingStatus;
  addedAt: string;
  lastOpenedAt?: string;
  finishedAt?: string;
  progress: number;
  favorite: boolean;
  collections: string[];
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
}

export interface ReadingPosition {
  bookId: string;
  location?: string;
  page?: number;
  percent: number;
  updatedAt: string;
}

export interface Bookmark {
  id: string;
  bookId: string;
  location?: string;
  page?: number;
  label: string;
  percent: number;
  createdAt: string;
}

export interface Highlight {
  id: string;
  bookId: string;
  cfiRange: string;
  text: string;
  note?: string;
  color: HighlightColor;
  chapter?: string;
  createdAt: string;
}

export type HighlightColor = "gold" | "sage" | "rose" | "sky";

export interface ReadingSession {
  id: string;
  bookId: string;
  startedAt: string;
  minutes: number;
}

export type ReaderTheme = "light" | "sepia" | "dark";
/** "follow" keeps the reading view in step with the app theme. */
export type ReaderThemeChoice = "follow" | ReaderTheme;
export type ReaderFont = "literata" | "newsreader" | "inter";
export type AppTheme = "light" | "dark" | "system";

export interface ReaderPreferences {
  fontSize: number;
  fontFamily: ReaderFont;
  lineHeight: number;
  margin: number;
  theme: ReaderThemeChoice;
  /** "theme" tints bright PDF pages to match the reading theme; "original" leaves them untouched. */
  pdfPages: "theme" | "original";
}
