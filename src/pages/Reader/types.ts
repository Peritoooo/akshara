import type {
  Highlight,
  ReaderPreferences,
  ReaderTheme,
} from "@/types";

export type ReaderPanel =
  | "toc"
  | "search"
  | "bookmarks"
  | "highlights"
  | "appearance"
  | "shortcuts";

export interface TocItem {
  id: string;
  label: string;
  href: string;
  depth: number;
  page?: number;
}

export interface ReaderTarget {
  cfi?: string;
  href?: string;
  percent?: number;
  page?: number;
}

export interface ReaderLocation {
  location?: string;
  href?: string;
  percent: number;
  page?: number;
  pageLabel?: string;
  chapter?: string;
  atStart: boolean;
  atEnd: boolean;
  zoom?: number;
}

export interface SelectionRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface SelectionInfo {
  cfiRange: string;
  text: string;
  chapter?: string;
  rect: SelectionRect;
}

export interface ReaderViewHandle {
  next: () => void;
  prev: () => void;
  goTo: (target: ReaderTarget) => void;
  clearSelection: () => void;
  zoomIn?: () => void;
  zoomOut?: () => void;
  /** Scan the whole book and stream partial results as pages/sections load. */
  search?: (
    query: string,
    onProgress: (progress: SearchProgress) => void,
  ) => Promise<SearchProgress>;
  /** Move to a result and mark it on the page. */
  focusSearchMatch?: (match: SearchMatch) => void;
  /** Remove every search highlight from the current page. */
  clearSearch?: () => void;
}

export interface SearchMatch {
  /** 1-based PDF page. Absent for reflowable books. */
  page?: number;
  /** EPUB CFI for the match. */
  cfi?: string;
  /** Page or chapter label shown in the results list. */
  label: string;
  /** Ordinal of the match within its page or section. */
  index: number;
  snippet: string;
}

export interface SearchProgress {
  scanned: number;
  total: number;
  matches: SearchMatch[];
  /** True when the result cap was reached. */
  truncated: boolean;
}

export interface ReaderViewProps {
  bookId: string;
  file: string;
  title: string;
  author: string;
  /** True when the PDF lives on this device (IndexedDB) instead of /books. */
  local?: boolean;
  pdfFit?: "page" | "width";
  initialTarget: ReaderTarget;
  preferences: ReaderPreferences;
  /** Resolved reading theme ("follow" already mapped to light/sepia/dark). */
  readerTheme: ReaderTheme;
  highlights: Highlight[];
  onReady: (toc: TocItem[]) => void;
  onLocation: (location: ReaderLocation) => void;
  onSelection: (selection: SelectionInfo | null) => void;
  onHighlightClick: (highlight: Highlight) => void;
  onError: (message: string) => void;
}
