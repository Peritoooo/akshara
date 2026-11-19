import type {
  Highlight,
  ReaderPreferences,
  ReaderTheme,
} from "@/types";

export type ReaderPanel =
  | "toc"
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
}

export interface ReaderViewProps {
  bookId: string;
  file: string;
  title: string;
  author: string;
  /** True when the PDF lives in this browser (IndexedDB) instead of /books. */
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
