import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  Feather,
  Loader2,
  RefreshCw,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useBook } from "@/hooks/useCatalog";
import { useLibraryStore } from "@/store/library";
import { useSessionStore } from "@/store/session";
import { useSettingsStore } from "@/store/settings";
import { useResolvedTheme } from "@/hooks/useTheme";
import { useReadingSession } from "@/hooks/useReadingSession";
import { savePdfFile } from "@/lib/pdfStore";
import { cn, percentLabel } from "@/lib/utils";
import { Dialog } from "@/components/ui/Dialog";
import { TextArea } from "@/components/ui/Field";
import type { Highlight, HighlightColor, ReaderTheme } from "@/types";
import { EpubView } from "./EpubView";
import { PdfView } from "./PdfView";
import { ReaderChrome } from "./ReaderChrome";
import { ReaderPanels } from "./ReaderPanels";
import { LogoMark } from "@/components/layout/LogoMark";
import { highlightColors, readerThemeMeta } from "./readerStyles";
import type {
  ReaderLocation,
  ReaderPanel,
  ReaderTarget,
  ReaderViewHandle,
  SelectionInfo,
  TocItem,
} from "./types";

interface HighlightDraft {
  cfiRange: string;
  text: string;
  chapter?: string;
  color: HighlightColor;
  note: string;
}

const colorOrder: HighlightColor[] = ["gold", "sage", "rose", "sky"];
const readerThemeCycle = ["follow", "light", "sepia", "dark"] as const;

export function ReaderPage() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const book = useBook(bookId);
  const appTheme = useResolvedTheme();

  const position = useLibraryStore((state) =>
    bookId ? state.positions[bookId] : undefined,
  );
  const allBookmarks = useLibraryStore((state) => state.bookmarks);
  const allHighlights = useLibraryStore((state) => state.highlights);
  const markOpened = useLibraryStore((state) => state.markOpened);
  const restartBook = useLibraryStore((state) => state.restartBook);
  const setProgress = useLibraryStore((state) => state.setProgress);
  const addBookmark = useLibraryStore((state) => state.addBookmark);
  const removeBookmark = useLibraryStore((state) => state.removeBookmark);
  const addHighlight = useLibraryStore((state) => state.addHighlight);
  const updateHighlightNote = useLibraryStore(
    (state) => state.updateHighlightNote,
  );
  const removeHighlight = useLibraryStore((state) => state.removeHighlight);

  const preferences = useSettingsStore((state) => state.reader);
  const setReader = useSettingsStore((state) => state.setReader);
  const signedIn = useSessionStore((state) => state.phase === "authenticated");

  // "follow" keeps the reading room in step with the app theme.
  const readerTheme: ReaderTheme =
    preferences.theme === "follow" ? appTheme : preferences.theme;

  const fromStart = useRef(searchParams.get("from") === "start");

  const [initialTarget] = useState<ReaderTarget>(() => {
    if (fromStart.current) return {};
    const cfi = searchParams.get("cfi");
    if (cfi && cfi.startsWith("epubcfi(")) return { cfi };
    const page = Number(searchParams.get("page"));
    if (Number.isFinite(page) && page > 0) return { page };
    const percent = Number(searchParams.get("percent"));
    if (Number.isFinite(percent) && percent > 0) {
      return { percent: Math.min(1, percent) };
    }
    if (position?.location) return { cfi: position.location };
    if (position?.page) return { page: position.page };
    if (position?.percent) return { percent: position.percent };
    return {};
  });

  const [location, setLocation] = useState<ReaderLocation>(() => ({
    percent: position?.percent ?? 0,
    page: position?.page,
    atStart: true,
    atEnd: false,
    chapter: undefined,
  }));
  const [toc, setToc] = useState<TocItem[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<ReaderPanel | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [pdfFit, setPdfFit] = useState<"page" | "width">("page");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [draft, setDraft] = useState<HighlightDraft | null>(null);
  const [editingHighlight, setEditingHighlight] = useState<Highlight | null>(
    null,
  );
  const [editNote, setEditNote] = useState("");
  const [epoch, setEpoch] = useState(0);
  const [showFocusHint, setShowFocusHint] = useState(false);
  const [attaching, setAttaching] = useState(false);

  const attachInputRef = useRef<HTMLInputElement>(null);

  const viewRef = useRef<ReaderViewHandle>(null);

  useReadingSession(bookId);

  const bookmarks = useMemo(
    () =>
      bookId ? allBookmarks.filter((bookmark) => bookmark.bookId === bookId) : [],
    [allBookmarks, bookId],
  );
  const highlights = useMemo(
    () =>
      bookId
        ? allHighlights.filter((highlight) => highlight.bookId === bookId)
        : [],
    [allHighlights, bookId],
  );

  const isPdf = book?.format === "pdf";

  useEffect(() => {
    if (!bookId) return;
    markOpened(bookId);
    if (fromStart.current) restartBook(bookId);
  }, [bookId, markOpened, restartBook]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (!book) return;
    const previous = document.title;
    document.title = `${book.title} · Akshara`;
    return () => {
      document.title = previous;
    };
  }, [book]);

  // The reader theme is independent from the app theme, so dialogs and
  // toasts adopt the reading palette while the reader is open.
  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    const previousBackground = root.style.backgroundColor;
    root.classList.toggle("dark", readerTheme === "dark");
    root.style.backgroundColor = readerThemeMeta[readerTheme].bg;
    root.style.colorScheme = readerTheme === "dark" ? "dark" : "light";
    return () => {
      root.classList.toggle("dark", wasDark);
      root.style.backgroundColor = previousBackground;
      root.style.colorScheme = "";
    };
  }, [readerTheme]);

  useEffect(() => {
    const onChange = () =>
      setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    onChange();
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (!focusMode) return;
    setShowFocusHint(true);
    const timer = window.setTimeout(() => setShowFocusHint(false), 4200);
    return () => window.clearTimeout(timer);
  }, [focusMode]);

  const handleReady = useCallback((items: TocItem[]) => {
    setToc(items);
    setReady(true);
    setError(null);
  }, []);

  const handleLocation = useCallback(
    (next: ReaderLocation) => {
      setLocation(next);
      setSelection(null);
      if (bookId) {
        setProgress(bookId, next.percent, next.location, next.page);
      }
    },
    [bookId, setProgress],
  );

  const handleSelection = useCallback((next: SelectionInfo | null) => {
    setSelection(next);
  }, []);

  const handleHighlightClick = useCallback((highlight: Highlight) => {
    setSelection(null);
    setEditingHighlight(highlight);
    setEditNote(highlight.note ?? "");
  }, []);

  const handleError = useCallback((message: string) => {
    setError(message);
    setReady(false);
  }, []);

  const handleBack = useCallback(() => {
    if (book) navigate(`/book/${book.id}`);
  }, [book, navigate]);

  const activeBookmark = useMemo(
    () =>
      bookmarks.find(
        (bookmark) =>
          Boolean(
            (location.location && bookmark.location === location.location) ||
              (location.page !== undefined &&
                bookmark.page !== undefined &&
                bookmark.page === location.page),
          ),
      ),
    [bookmarks, location],
  );

  const canBookmark = Boolean(
    location.location || location.page !== undefined,
  );

  const toggleBookmark = useCallback(() => {
    if (!bookId || !book || !canBookmark) return;
    if (activeBookmark) {
      removeBookmark(activeBookmark.id);
      toast("Bookmark removed", { description: book.title });
      return;
    }
    const label =
      location.chapter ??
      (location.page !== undefined
        ? `Page ${location.page}`
        : `Around ${percentLabel(location.percent)}`);
    addBookmark({
      bookId,
      location: book.format === "epub" ? location.location : undefined,
      page: book.format === "pdf" ? location.page : undefined,
      label,
      percent: location.percent,
    });
    toast.success("Bookmark added", { description: label });
  }, [
    activeBookmark,
    addBookmark,
    book,
    bookId,
    canBookmark,
    location,
    removeBookmark,
  ]);

  const handlePrev = useCallback(() => viewRef.current?.prev(), []);
  const handleNext = useCallback(() => viewRef.current?.next(), []);

  const handleSeek = useCallback((percent: number) => {
    viewRef.current?.goTo({ percent });
  }, []);

  const handleGoTo = useCallback((target: ReaderTarget) => {
    viewRef.current?.goTo(target);
    setSelection(null);
    setPanel(null);
  }, []);

  const handleZoomIn = useCallback(() => viewRef.current?.zoomIn?.(), []);
  const handleZoomOut = useCallback(() => viewRef.current?.zoomOut?.(), []);

  const toggleFocus = useCallback(() => {
    setPanel(null);
    setSelection(null);
    setFocusMode((current) => !current);
  }, []);

  const cycleTheme = useCallback(() => {
    const index = readerThemeCycle.indexOf(preferences.theme);
    const theme = readerThemeCycle[(index + 1) % readerThemeCycle.length];
    setReader({ theme });
  }, [preferences.theme, setReader]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      toast.error("Full screen is not available in this app");
    }
  }, []);

  const openPanel = useCallback((nextPanel: ReaderPanel) => {
    setSelection(null);
    setPanel((current) => (current === nextPanel ? null : nextPanel));
  }, []);

  const closePanel = useCallback(() => setPanel(null), []);

  const increaseText = useCallback(() => {
    setReader({ fontSize: Math.min(30, preferences.fontSize + 1) });
  }, [preferences.fontSize, setReader]);

  const decreaseText = useCallback(() => {
    setReader({ fontSize: Math.max(14, preferences.fontSize - 1) });
  }, [preferences.fontSize, setReader]);

  const saveHighlight = useCallback(
    (color: HighlightColor) => {
      if (!bookId || !selection) return;
      addHighlight({
        bookId,
        cfiRange: selection.cfiRange,
        text: selection.text,
        color,
        chapter: selection.chapter,
      });
      viewRef.current?.clearSelection();
      setSelection(null);
      toast.success("Highlight saved", {
        description: `${highlightColors[color].label} · ${selection.text.slice(0, 54)}${selection.text.length > 54 ? "…" : ""}`,
      });
    },
    [addHighlight, bookId, selection],
  );

  const openNoteDraft = useCallback(() => {
    if (!selection) return;
    setDraft({
      cfiRange: selection.cfiRange,
      text: selection.text,
      chapter: selection.chapter,
      color: "gold",
      note: "",
    });
  }, [selection]);

  const saveNote = useCallback(() => {
    if (!bookId || !draft) return;
    addHighlight({
      bookId,
      cfiRange: draft.cfiRange,
      text: draft.text,
      color: draft.color,
      chapter: draft.chapter,
      note: draft.note.trim() || undefined,
    });
    viewRef.current?.clearSelection();
    setDraft(null);
    setSelection(null);
    toast.success("Highlight and note saved");
  }, [addHighlight, bookId, draft]);

  const saveEditedNote = useCallback(() => {
    if (!editingHighlight) return;
    updateHighlightNote(editingHighlight.id, editNote.trim());
    setEditingHighlight(null);
    toast("Note updated");
  }, [editNote, editingHighlight, updateHighlightNote]);

  const deleteEditedHighlight = useCallback(() => {
    if (!editingHighlight) return;
    removeHighlight(editingHighlight.id);
    setEditingHighlight(null);
    toast("Highlight removed");
  }, [editingHighlight, removeHighlight]);

  const handleRestart = useCallback(() => {
    if (!bookId) return;
    restartBook(bookId);
    setPanel(null);
    setSelection(null);
    setError(null);
    setReady(false);
    setLocation({ percent: 0, atStart: true, atEnd: false });
    setEpoch((current) => current + 1);
    toast("Starting from the beginning", {
      description: book?.title,
    });
  }, [book, bookId, restartBook]);

  const handleRetry = useCallback(() => {
    setError(null);
    setReady(false);
    setEpoch((current) => current + 1);
  }, []);

  /** Sync brought this book here, but its PDF only exists where it was imported. */
  const handleAttachPdf = useCallback(
    async (file: File | undefined) => {
      if (!file || !book) return;
      setAttaching(true);
      try {
        await savePdfFile(book.id, file);
        toast.success("PDF attached to this book", {
          description: `${book.title} · your place and notes are kept.`,
        });
        handleRetry();
      } catch {
        toast.error("That PDF could not be stored on this device", {
          description: "It may be larger than the space available here.",
        });
      } finally {
        setAttaching(false);
      }
    },
    [book, handleRetry],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (draft || editingHighlight) return;

      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "input, textarea, select, [contenteditable='true'], [role='dialog']",
        )
      ) {
        return;
      }

      switch (event.key) {
        case "ArrowRight":
        case "PageDown":
          event.preventDefault();
          handleNext();
          break;
        case "ArrowLeft":
        case "PageUp":
          event.preventDefault();
          handlePrev();
          break;
        case "f":
        case "F":
          event.preventDefault();
          toggleFocus();
          break;
        case "t":
        case "T":
          event.preventDefault();
          openPanel("toc");
          break;
        case "b":
        case "B":
          event.preventDefault();
          toggleBookmark();
          break;
        case "s":
        case "S":
          event.preventDefault();
          openPanel("appearance");
          break;
        case "?":
          event.preventDefault();
          openPanel("shortcuts");
          break;
        case "Escape":
          if (panel) {
            setPanel(null);
          } else if (focusMode) {
            setFocusMode(false);
          }
          break;
        case "+":
        case "=":
          increaseText();
          break;
        case "-":
          decreaseText();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    decreaseText,
    draft,
    editingHighlight,
    focusMode,
    handleNext,
    handlePrev,
    increaseText,
    openPanel,
    panel,
    toggleBookmark,
    toggleFocus,
  ]);

  const popoverStyle = useMemo(() => {
    if (!selection) return undefined;
    const width = 236;
    const viewportWidth =
      typeof window === "undefined" ? 1024 : window.innerWidth;
    const left = Math.min(
      Math.max(12, selection.rect.left + selection.rect.width / 2 - width / 2),
      Math.max(12, viewportWidth - width - 12),
    );
    const above = selection.rect.top > 96;
    const top = above
      ? Math.max(12, selection.rect.top - 58)
      : selection.rect.top + selection.rect.height + 10;
    return { left, top, width };
  }, [selection]);

  if (!book || !bookId) {
    return (
      <div className="reader-body fixed inset-0 flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--reader-surface-strong)]">
            <BookOpen className="h-5 w-5" />
          </span>
          <h1 className="mt-5 font-display text-2xl text-[var(--reader-ink)]">
            This edition is not on the shelf
          </h1>
          <p className="mt-2 text-sm leading-relaxed reader-muted">
            The book could not be found. It may have been removed, or the link
            may be incomplete.
          </p>
          <Link
            to="/library"
            className="mt-6 inline-flex h-10 items-center gap-2 rounded-full bg-[var(--reader-ink)] px-5 text-sm font-medium text-[var(--reader-bg)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Return to library
          </Link>
        </div>
      </div>
    );
  }

  const viewTarget: ReaderTarget = epoch === 0 ? initialTarget : {};

  return (
    <div
      data-reader-theme={readerTheme}
      data-pdf-pages={preferences.pdfPages}
      data-reading-fullscreen={focusMode ? "true" : "false"}
      className="reader-body fixed inset-0 overflow-hidden"
    >
      <main className="reader-stage absolute inset-0">
        {error ? (
          <div className="flex h-full items-center justify-center px-6">
            <div className="max-w-md text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--reader-surface-strong)]">
                <BookOpen className="h-5 w-5" />
              </span>
              <h2 className="mt-5 font-display text-2xl text-[var(--reader-ink)]">
                The page would not open
              </h2>
              <p className="mt-2 text-sm leading-relaxed reader-muted">
                {error}
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={handleRetry}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--reader-ink)] px-5 text-sm font-medium text-[var(--reader-bg)]"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Try again
                </button>
                {book?.custom ? (
                  <button
                    type="button"
                    onClick={() => attachInputRef.current?.click()}
                    disabled={attaching}
                    className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--reader-line)] px-5 text-sm font-medium text-[var(--reader-ink)] disabled:opacity-60"
                  >
                    {attaching ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    Attach the PDF
                  </button>
                ) : null}
                <input
                  ref={attachInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="sr-only"
                  onChange={(event) => {
                    void handleAttachPdf(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={handleBack}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--reader-line)] px-5 text-sm font-medium text-[var(--reader-ink)]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to the book
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {isPdf ? (
              <PdfView
                key={`${bookId}-${epoch}`}
                ref={viewRef}
                bookId={book.id}
                file={book.file}
                title={book.title}
                author={book.author}
                local={book.custom}
                pdfFit={pdfFit}
                initialTarget={viewTarget}
                preferences={preferences}
                readerTheme={readerTheme}
                highlights={highlights}
                onReady={handleReady}
                onLocation={handleLocation}
                onSelection={handleSelection}
                onHighlightClick={handleHighlightClick}
                onError={handleError}
              />
            ) : (
              <EpubView
                key={`${bookId}-${epoch}`}
                ref={viewRef}
                bookId={book.id}
                file={book.file}
                title={book.title}
                author={book.author}
                initialTarget={viewTarget}
                preferences={preferences}
                readerTheme={readerTheme}
                highlights={highlights}
                onReady={handleReady}
                onLocation={handleLocation}
                onSelection={handleSelection}
                onHighlightClick={handleHighlightClick}
                onError={handleError}
              />
            )}

            {!ready ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[var(--reader-bg)]/75 backdrop-blur-[2px]">
                <div className="flex flex-col items-center text-center">
                  <LogoMark tone="reader" className="w-16" />
                  <Loader2 className="mt-4 h-5 w-5 animate-spin text-[var(--reader-accent)]" />
                  <p className="mt-3 text-[0.625rem] uppercase tracking-[0.22em] reader-muted">
                    Preparing your edition
                  </p>
                </div>
              </div>
            ) : null}
          </>
        )}
      </main>

      {!error ? (
        <>
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Previous page"
            className="reader-edge reader-edge-left"
          />
          <button
            type="button"
            onClick={handleNext}
            aria-label="Next page"
            className="reader-edge reader-edge-right"
          />

          <ReaderChrome
            book={book}
            theme={readerTheme}
            chapter={location.chapter}
            percent={location.percent}
            pageLabel={location.pageLabel}
            isPdf={isPdf}
            zoom={location.zoom ?? 1}
            pdfFit={pdfFit}
            isBookmarked={Boolean(activeBookmark)}
            canBookmark={canBookmark}
            focusMode={focusMode}
            isFullscreen={isFullscreen}
            activePanel={panel}
            atStart={location.atStart}
            atEnd={location.atEnd}
            onBack={handleBack}
            onToggleBookmark={toggleBookmark}
            onCycleTheme={cycleTheme}
            onToggleFocus={toggleFocus}
            onToggleFullscreen={() => void toggleFullscreen()}
            onOpenPanel={openPanel}
            onPrev={handlePrev}
            onNext={handleNext}
            onSeek={handleSeek}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onTogglePdfFit={() =>
              setPdfFit((current) => (current === "page" ? "width" : "page"))
            }
          />

          {focusMode && showFocusHint ? (
            <div className="pointer-events-none absolute right-3 top-[4.5rem] z-20 rounded-full border border-[var(--reader-line)] bg-[var(--reader-surface)]/90 px-3 py-1.5 text-[0.625rem] reader-muted shadow-soft backdrop-blur sm:right-5">
              Focus mode · press F or Esc to show controls
            </div>
          ) : null}

          {selection && !draft && !editingHighlight ? (
            <div
              role="toolbar"
              aria-label="Highlight selection"
              className="epub-selection-popover fixed z-50 flex items-center gap-1.5 rounded-full border border-[var(--reader-line)] bg-[var(--reader-surface)] px-2 py-1.5 shadow-lift"
              style={popoverStyle}
            >
              {colorOrder.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => saveHighlight(color)}
                  aria-label={`Highlight in ${highlightColors[color].label.toLowerCase()}`}
                  title={highlightColors[color].label}
                  className="h-6 w-6 rounded-full border border-black/10 transition-transform hover:scale-110"
                  style={{ backgroundColor: highlightColors[color].fill }}
                />
              ))}
              <span className="mx-0.5 h-5 w-px bg-[var(--reader-line)]" />
              <button
                type="button"
                onClick={openNoteDraft}
                className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-[0.7rem] font-medium text-[var(--reader-ink)] transition-colors hover:bg-[var(--reader-surface-strong)]"
              >
                <Feather className="h-3 w-3" />
                Note
              </button>
            </div>
          ) : null}

          <ReaderPanels
            panel={panel}
            onClose={closePanel}
            onPanelChange={openPanel}
            toc={toc}
            bookmarks={bookmarks}
            highlights={highlights}
            preferences={preferences}
            format={book.format}
            currentHref={location.href}
            currentPage={location.page}
            zoom={location.zoom ?? 1}
            onGoTo={handleGoTo}
            onRemoveBookmark={(id) => {
              removeBookmark(id);
              toast("Bookmark removed");
            }}
            onEditHighlight={handleHighlightClick}
            onRemoveHighlight={(id) => {
              removeHighlight(id);
              toast("Highlight removed");
            }}
            onChangePreferences={setReader}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onRestart={handleRestart}
          />
        </>
      ) : null}

      <Dialog
        open={Boolean(draft)}
        onOpenChange={(open) => {
          if (!open) setDraft(null);
        }}
        title="Add a note"
        description={
          draft?.chapter
            ? `A note on “${draft.chapter}”`
            : "Keep the passage and your thought together."
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="h-9 rounded-full px-4 text-[0.8125rem] font-medium text-ink-soft transition-colors hover:bg-muted hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveNote}
              className="h-9 rounded-full bg-ink px-4 text-[0.8125rem] font-medium text-canvas transition-opacity hover:opacity-90"
            >
              Save highlight
            </button>
          </>
        }
      >
        {draft ? (
          <div>
            <p className="line-clamp-3 border-l border-accent pl-3 font-reading text-[0.9rem] italic leading-relaxed text-ink-soft">
              “{draft.text}”
            </p>
            <div className="mt-4 flex items-center gap-2">
              <span className="text-[0.65rem] uppercase tracking-[0.14em] text-ink-muted">
                Color
              </span>
              {colorOrder.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() =>
                    setDraft((current) =>
                      current ? { ...current, color } : current,
                    )
                  }
                  aria-label={`Use ${highlightColors[color].label.toLowerCase()}`}
                  aria-pressed={draft.color === color}
                  className={cn(
                    "h-6 w-6 rounded-full border transition-transform hover:scale-110",
                    draft.color === color
                      ? "border-ink ring-2 ring-accent/40"
                      : "border-line",
                  )}
                  style={{
                    backgroundColor: highlightColors[color].fill,
                  }}
                />
              ))}
            </div>
            <TextArea
              className="mt-4 min-h-[6.5rem]"
              placeholder="What did this passage make you think of?"
              value={draft.note}
              onChange={(event) =>
                setDraft((current) =>
                  current ? { ...current, note: event.target.value } : current,
                )
              }
              aria-label="Your note"
            />
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={Boolean(editingHighlight)}
        onOpenChange={(open) => {
          if (!open) setEditingHighlight(null);
        }}
        title="Highlight & note"
        description={
          editingHighlight?.chapter
            ? editingHighlight.chapter
            : "Saved on this device"
        }
        footer={
          <>
            <button
              type="button"
              onClick={deleteEditedHighlight}
              className="mr-auto h-9 rounded-full px-3 text-[0.8125rem] font-medium text-rose transition-colors hover:bg-rose/10"
            >
              Delete highlight
            </button>
            <button
              type="button"
              onClick={() => setEditingHighlight(null)}
              className="h-9 rounded-full px-4 text-[0.8125rem] font-medium text-ink-soft transition-colors hover:bg-muted hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveEditedNote}
              className="h-9 rounded-full bg-ink px-4 text-[0.8125rem] font-medium text-canvas transition-opacity hover:opacity-90"
            >
              Save note
            </button>
          </>
        }
      >
        {editingHighlight ? (
          <div>
            <div className="flex items-start gap-3">
              <span
                className="mt-1.5 h-6 w-1 shrink-0 rounded-full"
                style={{
                  backgroundColor:
                    highlightColors[editingHighlight.color].fill,
                }}
              />
              <p className="font-reading text-[0.95rem] italic leading-relaxed text-ink-soft">
                “{editingHighlight.text}”
              </p>
            </div>
            <TextArea
              className="mt-4 min-h-[6.5rem]"
              placeholder="Add a note to this passage…"
              value={editNote}
              onChange={(event) => setEditNote(event.target.value)}
              aria-label="Highlight note"
            />
            <p className="mt-2 text-[0.625rem] text-ink-muted">
              {signedIn
                ? "Highlights and notes sync to your account. PDF files stay on this device."
                : "Highlights and notes live on this device. Nothing is uploaded."}
            </p>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
