import { useState } from "react";
import {
  ArrowLeft,
  ArrowLeftRight,
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  Expand,
  Highlighter,
  ListTree,
  Maximize,
  Minimize,
  Moon,
  Shrink,
  Sun,
  SunMedium,
  Type,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { Book, ReaderTheme } from "@/types";
import { cn, percentLabel } from "@/lib/utils";
import type { ReaderPanel } from "./types";

interface ReaderChromeProps {
  book: Book;
  theme: ReaderTheme;
  chapter?: string;
  percent: number;
  pageLabel?: string;
  isPdf: boolean;
  zoom: number;
  pdfFit: "page" | "width";
  isBookmarked: boolean;
  canBookmark: boolean;
  focusMode: boolean;
  isFullscreen: boolean;
  activePanel: ReaderPanel | null;
  atStart: boolean;
  atEnd: boolean;
  onBack: () => void;
  onToggleBookmark: () => void;
  onCycleTheme: () => void;
  onToggleFocus: () => void;
  onToggleFullscreen: () => void;
  onOpenPanel: (panel: ReaderPanel) => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (percent: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onTogglePdfFit: () => void;
}

const themeIcons = {
  light: Sun,
  sepia: SunMedium,
  dark: Moon,
} as const;

const panelButtons: Array<{
  panel: ReaderPanel;
  label: string;
  icon: typeof ListTree;
  className?: string;
}> = [
  { panel: "toc", label: "Contents", icon: ListTree },
  { panel: "bookmarks", label: "Bookmarks", icon: Bookmark, className: "hidden sm:inline-flex" },
  { panel: "highlights", label: "Highlights", icon: Highlighter, className: "hidden sm:inline-flex" },
  { panel: "appearance", label: "Reading appearance", icon: Type },
];

function ChromeButton({
  label,
  active,
  disabled,
  onClick,
  children,
  className,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      data-active={active ? "true" : undefined}
      className={cn(
        "reader-button inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function ReaderChrome({
  book,
  theme,
  chapter,
  percent,
  pageLabel,
  isPdf,
  zoom,
  pdfFit,
  isBookmarked,
  canBookmark,
  focusMode,
  isFullscreen,
  activePanel,
  atStart,
  atEnd,
  onBack,
  onToggleBookmark,
  onCycleTheme,
  onToggleFocus,
  onToggleFullscreen,
  onOpenPanel,
  onPrev,
  onNext,
  onSeek,
  onZoomIn,
  onZoomOut,
  onTogglePdfFit,
}: ReaderChromeProps) {
  const ThemeIcon = themeIcons[theme];
  const [seek, setSeek] = useState<number | null>(null);
  const display = seek ?? Math.round(percent * 1000);

  const commitSeek = () => {
    if (seek == null) return;
    onSeek(seek / 1000);
    setSeek(null);
  };

  return (
    <>
      <header className="reader-topbar reader-chrome absolute inset-x-0 top-0 z-30 border-b">
        <div className="mx-auto flex h-14 max-w-[100rem] items-center gap-1 px-2 sm:h-16 sm:gap-2 sm:px-5">
          <ChromeButton label="Back to book details" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </ChromeButton>

          <div className="min-w-0 flex-1 px-1">
            <p className="truncate font-display text-[0.9rem] leading-tight tracking-[-0.01em] sm:text-[0.98rem]">
              {book.title}
            </p>
            <p className="mt-0.5 truncate text-[0.625rem] leading-tight reader-muted">
              {chapter || book.author}
            </p>
          </div>

          <div className="flex items-center gap-0.5 sm:gap-1">
            <ChromeButton
              label={isBookmarked ? "Remove bookmark" : "Add bookmark"}
              active={isBookmarked}
              disabled={!canBookmark}
              onClick={onToggleBookmark}
            >
              {isBookmarked ? (
                <BookmarkCheck className="h-4 w-4" />
              ) : (
                <Bookmark className="h-4 w-4" />
              )}
            </ChromeButton>
            <ChromeButton label={`Reading theme: ${theme}. Change theme`} onClick={onCycleTheme}>
              <ThemeIcon className="h-4 w-4" />
            </ChromeButton>
            <ChromeButton
              label={focusMode ? "Exit focus mode" : "Enter focus mode"}
              active={focusMode}
              onClick={onToggleFocus}
            >
              {focusMode ? <Shrink className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
            </ChromeButton>
            <ChromeButton
              label={isFullscreen ? "Leave full screen" : "Full screen"}
              className="hidden sm:inline-flex"
              onClick={onToggleFullscreen}
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </ChromeButton>
          </div>
        </div>
      </header>

      <footer className="reader-bottombar reader-chrome absolute inset-x-0 bottom-0 z-30 border-t">
        <div className="mx-auto flex h-[4.25rem] max-w-5xl items-center gap-0.5 px-2 sm:h-[4.75rem] sm:gap-1.5 sm:px-6">
          <div className="flex items-center gap-0.5">
            {panelButtons.map(({ panel, label, icon: Icon, className }) => (
              <ChromeButton
                key={panel}
                label={label}
                active={activePanel === panel}
                onClick={() => onOpenPanel(panel)}
                className={className}
              >
                <Icon className="h-4 w-4" />
              </ChromeButton>
            ))}
          </div>

          <div className="mx-1 hidden h-6 w-px reader-divider sm:block" />

          <ChromeButton label="Previous page" onClick={onPrev}>
            <ChevronLeft className="h-[1.15rem] w-[1.15rem]" />
          </ChromeButton>

          <div className="min-w-0 flex-1 px-1 sm:px-2">
            <div className="mb-1 flex items-center justify-between gap-2 text-[0.575rem] uppercase tracking-[0.14em] reader-muted">
              <span className="truncate">{chapter || (isPdf ? book.title : "Reading")}</span>
              <span className="shrink-0 tabular-nums">
                {seek != null
                  ? percentLabel(seek / 1000)
                  : pageLabel
                    ? `${percentLabel(percent)} · ${pageLabel}`
                    : percentLabel(percent)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1000}
              step={1}
              value={display}
              aria-label="Reading progress"
              className="reader-seek"
              style={{ "--seek": `${display / 10}%` } as React.CSSProperties}
              onChange={(event) => setSeek(Number(event.target.value))}
              onPointerUp={commitSeek}
              onTouchEnd={commitSeek}
              onKeyUp={commitSeek}
              onBlur={commitSeek}
            />
          </div>

          <ChromeButton
            label="Next page"
            onClick={onNext}
          >
            <ChevronRight className="h-[1.15rem] w-[1.15rem]" />
          </ChromeButton>

          {isPdf ? (
            <div className="ml-1 hidden items-center gap-0.5 md:flex">
              <div className="mx-1 h-6 w-px reader-divider" />
              <ChromeButton
                label={
                  pdfFit === "width" ? "Fit the whole page" : "Fit page width"
                }
                active={pdfFit === "width"}
                onClick={onTogglePdfFit}
              >
                <ArrowLeftRight className="h-4 w-4" />
              </ChromeButton>
              <ChromeButton label="Zoom out" onClick={onZoomOut}>
                <ZoomOut className="h-4 w-4" />
              </ChromeButton>
              <span className="w-9 text-center text-[0.625rem] tabular-nums reader-muted">
                {Math.round(zoom * 100)}%
              </span>
              <ChromeButton label="Zoom in" onClick={onZoomIn}>
                <ZoomIn className="h-4 w-4" />
              </ChromeButton>
            </div>
          ) : null}
        </div>
      </footer>

      <span className="sr-only" aria-live="polite">
        {percentLabel(percent)} read
        {atStart ? ", at the beginning" : ""}
        {atEnd ? ", at the end" : ""}
      </span>
    </>
  );
}
