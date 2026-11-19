import { useEffect, useRef } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  Bookmark as BookmarkIcon,
  ChevronRight,
  Highlighter,
  ListTree,
  Minus,
  Plus,
  RotateCcw,
  Trash2,
  Type,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type {
  BookFormat,
  Bookmark,
  Highlight,
  ReaderPreferences,
  ReaderThemeChoice,
} from "@/types";
import type { ReaderPanel, ReaderTarget, TocItem } from "./types";
import { cn, formatDate, percentLabel } from "@/lib/utils";
import { seedSettings } from "@/data/seed";
import {
  highlightColors,
  readerFontLabels,
  readerFontStacks,
  readerThemeMeta,
} from "./readerStyles";

interface ReaderPanelsProps {
  panel: ReaderPanel | null;
  onClose: () => void;
  onPanelChange: (panel: ReaderPanel) => void;
  toc: TocItem[];
  bookmarks: Bookmark[];
  highlights: Highlight[];
  preferences: ReaderPreferences;
  format: BookFormat;
  currentHref?: string;
  currentPage?: number;
  zoom: number;
  onGoTo: (target: ReaderTarget) => void;
  onRemoveBookmark: (id: string) => void;
  onEditHighlight: (highlight: Highlight) => void;
  onRemoveHighlight: (id: string) => void;
  onChangePreferences: (patch: Partial<ReaderPreferences>) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRestart: () => void;
}

const tabs: Array<{ panel: ReaderPanel; label: string; icon: typeof ListTree }> = [
  { panel: "toc", label: "Contents", icon: ListTree },
  { panel: "bookmarks", label: "Bookmarks", icon: BookmarkIcon },
  { panel: "highlights", label: "Highlights", icon: Highlighter },
  { panel: "appearance", label: "Appearance", icon: Type },
];

const panelTitles: Record<ReaderPanel, string> = {
  toc: "Contents",
  bookmarks: "Bookmarks",
  highlights: "Highlights & notes",
  appearance: "Reading appearance",
  shortcuts: "Keyboard shortcuts",
};

const themes: ReaderThemeChoice[] = ["follow", "light", "sepia", "dark"];

function baseHref(href: string) {
  return decodeURIComponent(href.split("#")[0] ?? "");
}

function isCurrentToc(item: TocItem, currentHref: string | undefined, currentPage?: number) {
  if (currentPage !== undefined && item.page !== undefined) {
    return item.page === currentPage;
  }
  if (!currentHref) return false;
  const base = baseHref(currentHref);
  const candidate = baseHref(item.href);
  return Boolean(candidate) && (candidate === base || base.endsWith(candidate));
}

function PanelEmpty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--reader-line)] px-5 py-10 text-center">
      <p className="font-display text-[1.05rem] text-[var(--reader-ink)]">{title}</p>
      <p className="mx-auto mt-2 max-w-[18rem] text-[0.75rem] leading-relaxed reader-muted">
        {description}
      </p>
    </div>
  );
}

function RangeRow({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-[0.7rem] font-medium uppercase tracking-[0.14em] reader-muted">
          {label}
        </label>
        <span className="text-[0.7rem] tabular-nums reader-muted">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
        className="reader-range mt-2 w-full"
        style={{
          "--seek": `${((value - min) / (max - min)) * 100}%`,
        } as React.CSSProperties}
      />
    </div>
  );
}

export function ReaderPanels({
  panel,
  onClose,
  onPanelChange,
  toc,
  bookmarks,
  highlights,
  preferences,
  format,
  currentHref,
  currentPage,
  zoom,
  onGoTo,
  onRemoveBookmark,
  onEditHighlight,
  onRemoveHighlight,
  onChangePreferences,
  onZoomIn,
  onZoomOut,
  onRestart,
}: ReaderPanelsProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const activeTocRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  const previousPanelRef = useRef<ReaderPanel | null>(null);

  useEffect(() => {
    if (panel && !wasOpenRef.current) {
      const active = document.activeElement;
      restoreFocusRef.current =
        active instanceof HTMLElement && active !== document.body
          ? active
          : null;
    }
    if (!panel && wasOpenRef.current) {
      const target = restoreFocusRef.current;
      restoreFocusRef.current = null;
      window.requestAnimationFrame(() => {
        if (target?.isConnected) target.focus();
      });
    }
    wasOpenRef.current = Boolean(panel);
  }, [panel]);

  useEffect(() => {
    if (panel && previousPanelRef.current === null) {
      closeRef.current?.focus();
    }
    previousPanelRef.current = panel;
  }, [panel]);

  const trapFocus = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab" || !panelRef.current) return;
    const focusable = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => element.offsetParent !== null);
    if (focusable.length === 0) {
      event.preventDefault();
      panelRef.current.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === panelRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  useEffect(() => {
    if (panel !== "toc") return;
    const frame = window.requestAnimationFrame(() => {
      activeTocRef.current?.scrollIntoView({ block: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [panel, currentHref, currentPage]);

  useEffect(() => {
    if (!panel) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, onClose]);

  if (!panel) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="reader-backdrop absolute inset-0"
      />
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={panelTitles[panel]}
        tabIndex={-1}
        onKeyDown={trapFocus}
        className="reader-panel reader-panel-enter relative flex h-full w-full flex-col border-l shadow-[-24px_0_60px_-32px_rgba(0,0,0,0.35)] outline-none sm:max-w-[26rem]"
      >
        <div className="flex items-center gap-1 border-b border-[var(--reader-line)] px-2.5 py-2.5">
          {tabs.map(({ panel: tabPanel, label, icon: Icon }) => (
            <button
              key={tabPanel}
              type="button"
              onClick={() => onPanelChange(tabPanel)}
              aria-label={label}
              title={label}
              aria-current={panel === tabPanel ? "page" : undefined}
              className={cn(
                "inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                panel === tabPanel
                  ? "bg-[var(--reader-surface-strong)] text-[var(--reader-ink)]"
                  : "text-[var(--reader-muted)] hover:bg-[var(--reader-surface-strong)] hover:text-[var(--reader-ink)]",
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPanelChange("shortcuts")}
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts"
              className={cn(
                "inline-flex h-9 items-center justify-center rounded-full px-2.5 text-[0.625rem] uppercase tracking-[0.14em] transition-colors",
                panel === "shortcuts"
                  ? "bg-[var(--reader-surface-strong)] text-[var(--reader-ink)]"
                  : "text-[var(--reader-muted)] hover:bg-[var(--reader-surface-strong)] hover:text-[var(--reader-ink)]",
              )}
            >
              Keys
            </button>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close panel"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--reader-muted)] transition-colors hover:bg-[var(--reader-surface-strong)] hover:text-[var(--reader-ink)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="border-b border-[var(--reader-line)] px-5 pb-4 pt-5">
          <h2 className="font-display text-[1.5rem] leading-none tracking-[-0.02em] text-[var(--reader-ink)]">
            {panelTitles[panel]}
          </h2>
          {panel === "toc" ? (
            <p className="mt-2 text-[0.7rem] reader-muted">
              {format === "epub" ? "Chapters from this edition" : "Page landmarks from this PDF"}
            </p>
          ) : null}
          {panel === "bookmarks" ? (
            <p className="mt-2 text-[0.7rem] reader-muted">
              {bookmarks.length} saved {bookmarks.length === 1 ? "place" : "places"}
            </p>
          ) : null}
          {panel === "highlights" ? (
            <p className="mt-2 text-[0.7rem] reader-muted">
              {format === "epub"
                ? "Select text while reading to add a highlight."
                : "Highlights are available in EPUB editions. PDFs support bookmarks."}
            </p>
          ) : null}
        </div>

        <div className="reader-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {panel === "toc" ? (
            toc.length === 0 ? (
              <PanelEmpty
                title="No contents available"
                description="This edition does not include a navigable table of contents."
              />
            ) : (
              <nav aria-label="Table of contents" className="space-y-0.5">
                {toc.map((item) => {
                  const current = isCurrentToc(item, currentHref, currentPage);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      ref={current ? activeTocRef : undefined}
                      onClick={() => onGoTo({ href: item.href || undefined, page: item.page })}
                      aria-current={current ? "location" : undefined}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-lg py-2 pr-2 text-left text-[0.8125rem] leading-snug transition-colors",
                        current
                          ? "bg-[var(--reader-surface-strong)] font-medium text-[var(--reader-ink)]"
                          : "text-[var(--reader-ink-soft)] hover:bg-[var(--reader-surface-strong)] hover:text-[var(--reader-ink)]",
                      )}
                      style={{ paddingLeft: `${10 + item.depth * 14}px` }}
                    >
                      <span className="min-w-0 flex-1">{item.label}</span>
                      {item.page !== undefined ? (
                        <span className="shrink-0 pt-0.5 text-[0.625rem] tabular-nums reader-muted">
                          {item.page}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </nav>
            )
          ) : null}

          {panel === "bookmarks" ? (
            bookmarks.length === 0 ? (
              <PanelEmpty
                title="No bookmarks yet"
                description="Use the bookmark control above, or press B, to keep a page for later."
              />
            ) : (
              <ul className="space-y-2">
                {bookmarks.map((bookmark) => (
                  <li
                    key={bookmark.id}
                    className="group flex items-start gap-2 rounded-xl border border-[var(--reader-line)] bg-[var(--reader-bg)]/40 p-3"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        onGoTo({
                          cfi: bookmark.location,
                          page: bookmark.page,
                          percent: bookmark.percent,
                        })
                      }
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-[0.8125rem] text-[var(--reader-ink)]">
                        {bookmark.label}
                      </p>
                      <p className="mt-1 text-[0.625rem] reader-muted">
                        {percentLabel(bookmark.percent)} through · {formatDate(bookmark.createdAt)}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveBookmark(bookmark.id)}
                      aria-label="Delete bookmark"
                      className="shrink-0 rounded-full p-1.5 text-[var(--reader-muted)] opacity-70 transition-colors hover:bg-[var(--reader-surface-strong)] hover:text-[var(--reader-ink)] group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {panel === "highlights" ? (
            highlights.length === 0 ? (
              <PanelEmpty
                title={format === "pdf" ? "Highlights are for EPUBs" : "No highlights yet"}
                description={
                  format === "pdf"
                    ? "This fixed-layout PDF can be bookmarked page by page. Text highlights and notes live in the reflowable EPUB editions."
                    : "Select a passage that matters, then choose a color from the small popover. A note can be added at the same time."
                }
              />
            ) : (
              <ul className="space-y-2.5">
                {highlights.map((highlight) => (
                  <li
                    key={highlight.id}
                    className="group relative rounded-xl border border-[var(--reader-line)] bg-[var(--reader-bg)]/40 p-3.5 pl-4"
                  >
                    <span
                      className="absolute inset-y-3 left-0 w-[2px] rounded-full"
                      style={{ backgroundColor: highlightColors[highlight.color].fill }}
                    />
                    <button
                      type="button"
                      onClick={() => onEditHighlight(highlight)}
                      className="block w-full text-left"
                    >
                      {highlight.chapter ? (
                        <p className="text-[0.575rem] uppercase tracking-[0.14em] reader-muted">
                          {highlight.chapter}
                        </p>
                      ) : null}
                      <p className="mt-1.5 line-clamp-4 font-reading text-[0.875rem] leading-[1.65] text-[var(--reader-ink)]">
                        “{highlight.text}”
                      </p>
                      {highlight.note ? (
                        <p className="mt-2 border-t border-[var(--reader-line)] pt-2 text-[0.7rem] leading-relaxed reader-muted">
                          {highlight.note}
                        </p>
                      ) : null}
                    </button>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[0.575rem] reader-muted">
                        {formatDate(highlight.createdAt)}
                      </span>
                      <div className="flex items-center gap-0.5">
                        {highlight.cfiRange ? (
                          <button
                            type="button"
                            onClick={() => onGoTo({ cfi: highlight.cfiRange })}
                            aria-label="Go to highlight"
                            className="rounded-full p-1.5 text-[var(--reader-muted)] transition-colors hover:bg-[var(--reader-surface-strong)] hover:text-[var(--reader-ink)]"
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => onRemoveHighlight(highlight.id)}
                          aria-label="Delete highlight"
                          className="rounded-full p-1.5 text-[var(--reader-muted)] transition-colors hover:bg-[var(--reader-surface-strong)] hover:text-[var(--reader-ink)]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {panel === "appearance" ? (
            <div className="space-y-6">
              <div>
                <p className="text-[0.7rem] font-medium uppercase tracking-[0.14em] reader-muted">
                  Theme
                </p>
                <div className="mt-2.5 grid grid-cols-4 gap-2">
                  {themes.map((theme) => {
                    const active = preferences.theme === theme;
                    const meta = theme === "follow" ? undefined : readerThemeMeta[theme];
                    return (
                      <button
                        key={theme}
                        type="button"
                        onClick={() => onChangePreferences({ theme })}
                        aria-pressed={active}
                        className={cn(
                          "rounded-xl border p-2 text-left transition-all",
                          active
                            ? "border-[var(--reader-accent)] ring-1 ring-[var(--reader-accent)]"
                            : "border-[var(--reader-line)] hover:border-[var(--reader-accent)]/60",
                        )}
                        style={
                          meta
                            ? { backgroundColor: meta.bg, color: meta.fg }
                            : { backgroundColor: "var(--reader-bg)", color: "var(--reader-ink)" }
                        }
                      >
                        <span className="flex items-center gap-1.5 text-[0.625rem] font-medium">
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: meta?.accent ?? "var(--reader-accent)" }}
                          />
                          {meta?.label ?? "Match site"}
                        </span>
                        <span className="mt-3 block font-display text-[1.15rem] leading-none">
                          Aa
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {format === "pdf" ? (
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[0.7rem] font-medium uppercase tracking-[0.14em] reader-muted">
                      PDF pages
                    </p>
                    <span className="text-[0.65rem] reader-muted">
                      {preferences.pdfPages === "theme" ? "Blended" : "As printed"}
                    </span>
                  </div>
                  <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                    {(
                      [
                        ["theme", "Match theme"],
                        ["original", "Original"],
                      ] as const
                    ).map(([value, label]) => {
                      const active = preferences.pdfPages === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => onChangePreferences({ pdfPages: value })}
                          aria-pressed={active}
                          className={cn(
                            "rounded-lg border px-2 py-2 text-[0.7rem] transition-colors",
                            active
                              ? "border-[var(--reader-accent)] bg-[var(--reader-surface-strong)] text-[var(--reader-ink)]"
                              : "border-[var(--reader-line)] text-[var(--reader-muted)] hover:text-[var(--reader-ink)]",
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[0.65rem] leading-relaxed reader-muted">
                    Tints bright pages to sit softly in the current theme. Choose
                    Original for scans and artwork that should stay as printed.
                  </p>
                </div>
              ) : null}

              <div>
                <div className="flex items-center justify-between">
                  <p className="text-[0.7rem] font-medium uppercase tracking-[0.14em] reader-muted">
                    Text size
                  </p>
                  <span className="text-[0.7rem] tabular-nums reader-muted">
                    {preferences.fontSize}px
                  </span>
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onChangePreferences({
                        fontSize: Math.max(14, preferences.fontSize - 1),
                      })
                    }
                    aria-label="Decrease text size"
                    className="reader-button flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--reader-line)]"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <input
                    type="range"
                    min={14}
                    max={30}
                    step={1}
                    value={preferences.fontSize}
                    aria-label="Text size"
                    onChange={(event) =>
                      onChangePreferences({ fontSize: Number(event.target.value) })
                    }
                    className="reader-range w-full"
                    style={{
                      "--seek": `${((preferences.fontSize - 14) / 16) * 100}%`,
                    } as React.CSSProperties}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      onChangePreferences({
                        fontSize: Math.min(30, preferences.fontSize + 1),
                      })
                    }
                    aria-label="Increase text size"
                    className="reader-button flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--reader-line)]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className={format === "pdf" ? "opacity-45" : undefined}>
                <p className="text-[0.7rem] font-medium uppercase tracking-[0.14em] reader-muted">
                  Typeface
                </p>
                <div className="mt-2.5 space-y-1.5">
                  {(["literata", "newsreader", "inter"] as const).map((font) => (
                    <button
                      key={font}
                      type="button"
                      disabled={format === "pdf"}
                      onClick={() => onChangePreferences({ fontFamily: font })}
                      aria-pressed={preferences.fontFamily === font}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors",
                        preferences.fontFamily === font
                          ? "border-[var(--reader-accent)] bg-[var(--reader-surface-strong)]"
                          : "border-[var(--reader-line)] hover:bg-[var(--reader-surface-strong)]",
                      )}
                    >
                      <span
                        className="text-[0.9rem] text-[var(--reader-ink)]"
                        style={{ fontFamily: readerFontStacks[font] }}
                      >
                        {readerFontLabels[font]}
                      </span>
                      <span className="text-[0.6rem] reader-muted">
                        {font === "literata"
                          ? "Serif"
                          : font === "newsreader"
                            ? "Editorial"
                            : "Sans"}
                      </span>
                    </button>
                  ))}
                </div>
                {format === "pdf" ? (
                  <p className="mt-2 text-[0.65rem] leading-relaxed reader-muted">
                    This PDF is fixed-layout, so type controls apply to EPUB editions.
                  </p>
                ) : null}
              </div>

              <RangeRow
                label="Line spacing"
                value={preferences.lineHeight}
                display={preferences.lineHeight.toFixed(2)}
                min={1.4}
                max={2.2}
                step={0.05}
                onChange={(lineHeight) => onChangePreferences({ lineHeight })}
              />

              <div>
                <p className="text-[0.7rem] font-medium uppercase tracking-[0.14em] reader-muted">
                  Margins
                </p>
                <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                  {["Narrow", "Regular", "Generous"].map((label, index) => {
                    const value = index + 1;
                    const active = preferences.margin === value;
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => onChangePreferences({ margin: value })}
                        aria-pressed={active}
                        className={cn(
                          "rounded-lg border px-2 py-2 text-[0.7rem] transition-colors",
                          active
                            ? "border-[var(--reader-accent)] bg-[var(--reader-surface-strong)] text-[var(--reader-ink)]"
                            : "border-[var(--reader-line)] text-[var(--reader-muted)] hover:text-[var(--reader-ink)]",
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {format === "pdf" ? (
                <div>
                  <p className="text-[0.7rem] font-medium uppercase tracking-[0.14em] reader-muted">
                    Page zoom
                  </p>
                  <div className="mt-2.5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onZoomOut}
                      aria-label="Zoom out"
                      className="reader-button flex h-9 w-9 items-center justify-center rounded-full border border-[var(--reader-line)]"
                    >
                      <ZoomOut className="h-3.5 w-3.5" />
                    </button>
                    <span className="min-w-[3.5rem] text-center text-[0.8125rem] tabular-nums text-[var(--reader-ink)]">
                      {Math.round(zoom * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={onZoomIn}
                      aria-label="Zoom in"
                      className="reader-button flex h-9 w-9 items-center justify-center rounded-full border border-[var(--reader-line)]"
                    >
                      <ZoomIn className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-3 border-t border-[var(--reader-line)] pt-4">
                <button
                  type="button"
                  onClick={() => onChangePreferences(seedSettings.reader)}
                  className="inline-flex items-center gap-1.5 text-[0.7rem] reader-muted transition-colors hover:text-[var(--reader-ink)]"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset appearance
                </button>
                <button
                  type="button"
                  onClick={onRestart}
                  className="text-[0.7rem] reader-muted transition-colors hover:text-[var(--reader-ink)]"
                >
                  Start from the beginning
                </button>
              </div>
              <p className="text-[0.625rem] leading-relaxed reader-muted">
                Preferences are saved on this device and apply every time you open a book.
              </p>
            </div>
          ) : null}

          {panel === "shortcuts" ? (
            <dl className="space-y-2.5">
              {[
                { keys: ["←", "→"], label: "Previous / next page" },
                { keys: ["F"], label: "Toggle focus mode" },
                { keys: ["T"], label: "Table of contents" },
                { keys: ["B"], label: "Add or remove a bookmark" },
                { keys: ["S"], label: "Reading appearance" },
                { keys: ["+", "−"], label: "Text size" },
                { keys: ["?"], label: "Show all shortcuts" },
                { keys: ["Esc"], label: "Close panels / leave focus mode" },
              ].map((shortcut) => (
                <div
                  key={shortcut.label}
                  className="flex items-center justify-between gap-4 border-b border-[var(--reader-line)] pb-2.5 last:border-0"
                >
                  <dt className="text-[0.78rem] text-[var(--reader-ink-soft)]">
                    {shortcut.label}
                  </dt>
                  <dd className="flex shrink-0 items-center gap-1">
                    {shortcut.keys.map((key) => (
                      <kbd
                        key={key}
                        className="rounded border border-[var(--reader-line)] bg-[var(--reader-bg)] px-1.5 py-0.5 font-sans text-[0.625rem] text-[var(--reader-muted)]"
                      >
                        {key}
                      </kbd>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </section>
    </div>
  );
}
