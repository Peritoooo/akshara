import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import ePub from "epubjs";
import type { Book as EpubBook, Contents, NavItem, Rendition } from "epubjs";
import type { Highlight, ReaderPreferences, ReaderTheme } from "@/types";
import { epubContentCss, highlightColors } from "./readerStyles";
import type {
  ReaderTarget,
  ReaderViewHandle,
  ReaderViewProps,
  SearchMatch,
  SearchProgress,
  SelectionInfo,
  TocItem,
} from "./types";

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const SEARCH_RESULT_LIMIT = 500;

interface SearchableSection {
  href: string;
  load: (request?: unknown) => Promise<unknown>;
  find: (query: string) => Array<{ cfi: string; excerpt: string }>;
  search?: (
    query: string,
    maxSeqEle?: number,
  ) => Array<{ cfi: string; excerpt: string }>;
}

const locationsKey = (bookId: string) => `akshara-locations-v1:${bookId}`;

function flattenToc(items: NavItem[], depth = 0, result: TocItem[] = []) {
  items.forEach((item, index) => {
    const label = (item.label || "").replace(/\s+/g, " ").trim();
    if (label && item.href) {
      result.push({
        id: item.id || `${depth}-${index}-${item.href}`,
        label,
        href: item.href,
        depth,
      });
    }
    if (item.subitems?.length) {
      flattenToc(item.subitems, depth + 1, result);
    }
  });
  return result;
}

function baseHref(href: string) {
  return decodeURIComponent(href.split("#")[0] ?? "");
}

function chapterFor(href: string | undefined, toc: TocItem[]) {
  if (!href) return undefined;
  const base = baseHref(href);
  const matches = toc.filter((item) => {
    const candidate = baseHref(item.href);
    return candidate === base || base.endsWith(candidate) || candidate.endsWith(base);
  });
  return matches.at(-1)?.label;
}

function toContentsArray(rendition: Rendition): Contents[] {
  const contents = rendition.getContents() as unknown as Contents | Contents[];
  return Array.isArray(contents) ? contents : [contents];
}

async function displayTarget(
  rendition: Rendition,
  target: string | number | undefined,
) {
  if (target === undefined) {
    await rendition.display();
    return;
  }
  if (typeof target === "number") {
    await rendition.display(target);
    return;
  }
  await rendition.display(target);
}

export const EpubView = forwardRef<ReaderViewHandle, ReaderViewProps>(
  function EpubView(
    {
      bookId,
      file,
      title,
      initialTarget,
      preferences,
      readerTheme,
      highlights,
      onReady,
      onLocation,
      onSelection,
      onHighlightClick,
      onError,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const bookRef = useRef<EpubBook | null>(null);
    const renditionRef = useRef<Rendition | null>(null);
    const [renditionReady, setRenditionReady] = useState(false);

    const onReadyRef = useRef(onReady);
    const onLocationRef = useRef(onLocation);
    const onSelectionRef = useRef(onSelection);
    const onHighlightClickRef = useRef(onHighlightClick);
    const onErrorRef = useRef(onError);
    const tocRef = useRef<TocItem[]>([]);
    const chapterRef = useRef<string | undefined>(undefined);
    const highlightsRef = useRef(highlights);
    const attachedRef = useRef<Set<string>>(new Set());
    const ensureLocationsRef = useRef<() => Promise<void>>(async () => {});
    const searchTokenRef = useRef(0);
    const searchAnnotationRef = useRef<string | null>(null);
    const preferencesRef = useRef<ReaderPreferences>(preferences);
    const readerThemeRef = useRef<ReaderTheme>(readerTheme);

    onReadyRef.current = onReady;
    onLocationRef.current = onLocation;
    onSelectionRef.current = onSelection;
    onHighlightClickRef.current = onHighlightClick;
    onErrorRef.current = onError;
    highlightsRef.current = highlights;
    preferencesRef.current = preferences;
    readerThemeRef.current = readerTheme;

    const applyHighlights = () => {
      const rendition = renditionRef.current;
      if (!rendition) return;
      attachedRef.current.forEach((cfi) => {
        try {
          rendition.annotations.remove(cfi, "highlight");
        } catch {
          /* annotation was never attached in this view */
        }
      });
      attachedRef.current.clear();

      highlightsRef.current.forEach((highlight: Highlight) => {
        if (!highlight.cfiRange) return;
        try {
          rendition.annotations.highlight(
            highlight.cfiRange,
            { id: highlight.id },
            () => onHighlightClickRef.current(highlight),
            "akshara-highlight",
            {
              fill: highlightColors[highlight.color].fill,
              "fill-opacity": "0.38",
            },
          );
          attachedRef.current.add(highlight.cfiRange);
        } catch {
          /* malformed or stale CFI — the note remains available in the panel */
        }
      });
    };

    const reportLocation = () => {
      const rendition = renditionRef.current;
      const epubBook = bookRef.current;
      if (!rendition || !epubBook) return;

      let current: unknown;
      try {
        current = rendition.currentLocation();
      } catch {
        return;
      }
      const location = current as
        | {
            start?: {
              cfi?: string;
              href?: string;
              percentage?: number;
              displayed?: { page?: number; total?: number };
            };
            atStart?: boolean;
            atEnd?: boolean;
          }
        | undefined;

      const start = location?.start;
      if (!start?.cfi) return;

      let percent = start.percentage;
      if (percent == null && epubBook.locations.length() > 0) {
        try {
          percent = epubBook.locations.percentageFromCfi(start.cfi);
        } catch {
          percent = undefined;
        }
      }

      const chapter = chapterFor(start.href, tocRef.current);
      chapterRef.current = chapter;

      onLocationRef.current({
        location: start.cfi,
        href: start.href,
        percent: clamp(percent ?? 0),
        pageLabel:
          start.displayed?.page && start.displayed?.total
            ? `${start.displayed.page} / ${start.displayed.total}`
            : undefined,
        chapter,
        atStart: Boolean(location?.atStart),
        atEnd: Boolean(location?.atEnd),
      });
    };

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      let cancelled = false;
      let resizeTimer: number | undefined;
      let observer: ResizeObserver | undefined;
      let locationsPromise: Promise<void> | null = null;

      const epubBook = ePub(`${import.meta.env.BASE_URL}books/${file}`);
      bookRef.current = epubBook;

      const ensureLocations = async () => {
        if (!epubBook || epubBook.locations.length() > 0) return;
        if (locationsPromise) return locationsPromise;
        locationsPromise = (async () => {
          try {
            await epubBook.locations.generate(1400);
            try {
              localStorage.setItem(locationsKey(bookId), epubBook.locations.save());
            } catch {
              /* storage may be full; reading still works */
            }
          } catch {
            /* locations are an enhancement; never block reading on them */
          }
        })();
        return locationsPromise;
      };
      ensureLocationsRef.current = ensureLocations;

      const setup = async () => {
        try {
          await epubBook.ready;
          if (cancelled) {
            epubBook.destroy();
            return;
          }

          const navigation = await epubBook.loaded.navigation;
          if (cancelled) return;
          const toc = flattenToc(navigation.toc ?? []);
          tocRef.current = toc;

          try {
            const saved = localStorage.getItem(locationsKey(bookId));
            if (saved) epubBook.locations.load(saved);
          } catch {
            /* ignore corrupt saved locations */
          }

          const target = initialTarget;
          const needsPercent =
            !target.cfi &&
            !target.href &&
            target.percent !== undefined &&
            target.percent > 0;

          if (needsPercent && epubBook.locations.length() === 0) {
            await ensureLocations();
            if (cancelled) return;
          }

          if (cancelled || !containerRef.current) return;
          containerRef.current.innerHTML = "";

          const rendition = epubBook.renderTo(containerRef.current, {
            width: "100%",
            height: "100%",
            flow: "paginated",
            spread: "none",
            manager: "default",
            allowScriptedContent: true,
            snap: true,
          });
          renditionRef.current = rendition;

          const injectTypography = (contents: Contents) => {
            try {
              contents.addStylesheetCss(
                epubContentCss(preferencesRef.current, readerThemeRef.current),
                "akshara",
              );
            } catch {
              /* view is between documents */
            }
          };
          rendition.hooks.content.register(injectTypography);

          rendition.on("relocated", reportLocation);
          rendition.on("selected", (cfiRange: string, contents: Contents) => {
            try {
              const range = contents.range(cfiRange);
              const text = range.toString().replace(/\s+/g, " ").trim();
              if (!text) return;
              const frameRect = (
                contents.window.frameElement as HTMLElement | null
              )?.getBoundingClientRect();
              const rect = range.getBoundingClientRect();
              const selection: SelectionInfo = {
                cfiRange,
                text: text.slice(0, 6000),
                chapter: chapterRef.current,
                rect: {
                  top: rect.top + (frameRect?.top ?? 0),
                  left: rect.left + (frameRect?.left ?? 0),
                  width: rect.width,
                  height: rect.height,
                },
              };
              onSelectionRef.current(selection);
            } catch {
              /* ignore selections that cannot be mapped to a range */
            }
          });
          rendition.on("markClicked", () => {
            onSelectionRef.current(null);
          });
          rendition.on("mousedown", (_event: MouseEvent, contents: Contents) => {
            try {
              const currentSelection = contents.window.getSelection();
              if (!currentSelection || currentSelection.isCollapsed) {
                onSelectionRef.current(null);
              }
            } catch {
              /* iframe is between views */
            }
          });

          let touchStart: { x: number; y: number; time: number } | null = null;
          rendition.on("touchstart", (event: TouchEvent) => {
            const touch = event.touches[0];
            if (!touch) return;
            touchStart = {
              x: touch.clientX,
              y: touch.clientY,
              time: Date.now(),
            };
          });
          rendition.on("touchend", (event: TouchEvent, contents: Contents) => {
            const start = touchStart;
            touchStart = null;
            if (!start) return;
            if (contents.window.getSelection()?.toString()) return;
            const touch = event.changedTouches[0];
            if (!touch) return;
            const dx = touch.clientX - start.x;
            const dy = touch.clientY - start.y;
            if (Date.now() - start.time > 750) return;
            if (Math.abs(dx) < 64 || Math.abs(dy) > 54) return;
            try {
              if (dx < 0) void rendition.next();
              else void rendition.prev();
            } catch {
              /* edge of the book */
            }
          });

          let destination: string | number | undefined;
          if (target.cfi) destination = target.cfi;
          else if (target.href) destination = target.href;
          else if (needsPercent) {
            try {
              destination = epubBook.locations.cfiFromPercentage(
                clamp(target.percent ?? 0),
              );
            } catch {
              const sections = (epubBook.spine.last()?.index ?? 0) + 1;
              destination = Math.max(
                0,
                Math.floor(clamp(target.percent ?? 0) * sections),
              );
            }
          }

          if (destination !== undefined) {
            await displayTarget(rendition, destination);
          } else {
            await displayTarget(rendition, undefined);
          }
          if (cancelled) return;

          // Webfonts and the injected typography change page boundaries. Wait for
          // the first view to settle, then re-apply the target so precise CFIs
          // (for example an opened highlight) land on the correct page.
          try {
            await Promise.all(
              toContentsArray(rendition).map((contents) =>
                Promise.resolve(contents.document.fonts?.ready).catch(
                  () => undefined,
                ),
              ),
            );
          } catch {
            /* fonts are an enhancement; continue with the current layout */
          }
          if (cancelled) return;
          if (destination !== undefined) {
            await displayTarget(rendition, destination);
            if (cancelled) return;
          }

          setRenditionReady(true);
          onReadyRef.current(toc);
          reportLocation();
          applyHighlights();

          observer = new ResizeObserver((entries) => {
            const box = entries[0]?.contentRect;
            if (!box || box.width < 2 || box.height < 2) return;
            window.clearTimeout(resizeTimer);
            resizeTimer = window.setTimeout(() => {
              try {
                renditionRef.current?.resize(box.width, box.height);
              } catch {
                /* rendition is between views */
              }
            }, 140);
          });
          observer.observe(containerRef.current);

          if (epubBook.locations.length() === 0) {
            void ensureLocations().then(() => {
              if (!cancelled) reportLocation();
            });
          }
        } catch (error) {
          if (cancelled) return;
          const message =
            error instanceof Error ? error.message : "Unknown EPUB error";
          onErrorRef.current(
            `This edition could not be opened. ${message ? `(${message})` : ""}`,
          );
        }
      };

      void setup();

      return () => {
        cancelled = true;
        window.clearTimeout(resizeTimer);
        observer?.disconnect();
        attachedRef.current.clear();
        renditionRef.current = null;
        bookRef.current = null;
        setRenditionReady(false);
        try {
          epubBook.destroy();
        } catch {
          /* already destroyed */
        }
        if (containerRef.current) containerRef.current.innerHTML = "";
      };
      // The edition is intentionally opened once per title.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bookId, file]);

    useEffect(() => {
      if (!renditionReady) return;
      applyHighlights();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [highlights, renditionReady]);

    useEffect(() => {
      if (!renditionReady) return;
      const rendition = renditionRef.current;
      if (!rendition) return;
      const css = epubContentCss(preferences, readerTheme);
      toContentsArray(rendition).forEach((contents) => {
        try {
          contents.addStylesheetCss(css, "akshara");
        } catch {
          /* ignore views that are unloading */
        }
      });
    }, [preferences, readerTheme, renditionReady]);

    useImperativeHandle(
      ref,
      () => ({
        next: () => {
          try {
            void renditionRef.current?.next();
          } catch {
            /* at the end of the book */
          }
        },
        prev: () => {
          try {
            void renditionRef.current?.prev();
          } catch {
            /* at the start of the book */
          }
        },
        goTo: (target: ReaderTarget) => {
          const rendition = renditionRef.current;
          const epubBook = bookRef.current;
          if (!rendition || !epubBook) return;
          void (async () => {
            try {
              if (target.cfi || target.href) {
                await displayTarget(rendition, target.cfi ?? target.href);
                return;
              }
              if (target.percent !== undefined) {
                await ensureLocationsRef.current();
                const percent = clamp(target.percent);
                let destination: string | number;
                try {
                  destination = epubBook.locations.cfiFromPercentage(percent);
                } catch {
                  const sections = (epubBook.spine.last()?.index ?? 0) + 1;
                  destination = Math.max(
                    0,
                    Math.floor(percent * sections),
                  );
                }
                await displayTarget(rendition, destination);
              }
            } catch {
              onErrorRef.current("We could not find that place in the book.");
            }
          })();
        },
        clearSelection: () => {
          const rendition = renditionRef.current;
          if (!rendition) return;
          toContentsArray(rendition).forEach((contents) => {
            try {
              contents.window.getSelection()?.removeAllRanges();
            } catch {
              /* iframe may have been unloaded */
            }
          });
          onSelectionRef.current(null);
        },
        search: async (
          query: string,
          onProgress: (progress: SearchProgress) => void,
        ): Promise<SearchProgress> => {
          const epubBook = bookRef.current;
          const spine = epubBook?.spine as unknown as
            | { length: number; get: (index: number) => SearchableSection }
            | undefined;
          const total = spine?.length ?? 0;
          if (!epubBook || !spine || !query.trim()) {
            return { scanned: 0, total, matches: [], truncated: false };
          }

          const token = ++searchTokenRef.current;
          const matches: SearchMatch[] = [];
          let truncated = false;
          let scanned = 0;

          for (let index = 0; index < total; index += 1) {
            if (token !== searchTokenRef.current) break;

            const section = spine.get(index);
            if (section) {
              try {
                await section.load(epubBook.load.bind(epubBook));
                const found = section.search
                  ? section.search(query)
                  : section.find(query);
                const label =
                  chapterFor(section.href, tocRef.current) ??
                  `Section ${index + 1}`;
                found.forEach((entry, matchIndex) => {
                  if (matches.length >= SEARCH_RESULT_LIMIT) {
                    truncated = true;
                    return;
                  }
                  matches.push({
                    cfi: entry.cfi,
                    label,
                    index: matchIndex,
                    snippet: (entry.excerpt ?? "")
                      .replace(/\s+/g, " ")
                      .trim(),
                  });
                });
              } catch {
                /* A section that will not load cannot be searched. */
              }
            }

            scanned = index + 1;
            if (truncated || index % 2 === 0 || index === total - 1) {
              onProgress({
                scanned,
                total,
                matches: [...matches],
                truncated,
              });
            }
            if (truncated) break;
          }

          return { scanned, total, matches, truncated };
        },
        focusSearchMatch: (match: SearchMatch) => {
          const rendition = renditionRef.current;
          if (!rendition || !match.cfi) return;
          const cfi = match.cfi;
          void (async () => {
            try {
              await rendition.display(cfi);
              if (searchAnnotationRef.current) {
                try {
                  rendition.annotations.remove(
                    searchAnnotationRef.current,
                    "highlight",
                  );
                } catch {
                  /* annotation was not attached */
                }
                searchAnnotationRef.current = null;
              }
              rendition.annotations.highlight(
                cfi,
                {},
                () => {},
                "akshara-search",
                { fill: "#c6a978", "fill-opacity": "0.45" },
              );
              searchAnnotationRef.current = cfi;
            } catch {
              onErrorRef.current("We could not find that place in the book.");
            }
          })();
        },
        clearSearch: () => {
          searchTokenRef.current += 1;
          const rendition = renditionRef.current;
          if (rendition && searchAnnotationRef.current) {
            try {
              rendition.annotations.remove(
                searchAnnotationRef.current,
                "highlight",
              );
            } catch {
              /* annotation was not attached */
            }
          }
          searchAnnotationRef.current = null;
        },
        zoomIn: undefined,
        zoomOut: undefined,
      }),
      [],
    );

    return (
      <div
        ref={containerRef}
        className="reader-epub mx-auto h-full w-full max-w-[48rem]"
        role="document"
        aria-label={`${title} — reading view`}
      />
    );
  },
);
