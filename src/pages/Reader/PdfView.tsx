import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type {
  PDFDocumentProxy,
  PDFPageProxy,
  RenderTask,
  TextLayer,
} from "pdfjs-dist";
import { loadPdfFile } from "@/lib/pdfStore";
import { highlightColors } from "./readerStyles";
import type {
  ReaderLocation,
  ReaderTarget,
  ReaderViewHandle,
  ReaderViewProps,
  TocItem,
} from "./types";

type PdfTextContent = Awaited<ReturnType<PDFPageProxy["getTextContent"]>>;

interface PdfOutlineNode {
  title?: string;
  dest?: string | unknown[] | null;
  items?: PdfOutlineNode[];
}

async function resolveOutline(
  pdf: PDFDocumentProxy,
  nodes: PdfOutlineNode[] | null,
  depth = 0,
  result: TocItem[] = [],
): Promise<TocItem[]> {
  if (!nodes?.length) return result;

  for (const [index, node] of nodes.entries()) {
    const label = (node.title ?? "").replace(/\s+/g, " ").trim();
    let page: number | undefined;

    try {
      let destination = node.dest;
      if (typeof destination === "string") {
        destination = await pdf.getDestination(destination);
      }
      if (Array.isArray(destination) && destination[0]) {
        const pageIndex = await pdf.getPageIndex(
          destination[0] as Parameters<PDFDocumentProxy["getPageIndex"]>[0],
        );
        page = pageIndex + 1;
      }
    } catch {
      page = undefined;
    }

    if (label) {
      result.push({
        id: `outline-${depth}-${index}-${label}`,
        label,
        href: "",
        depth,
        page,
      });
    }

    if (node.items?.length) {
      await resolveOutline(pdf, node.items, depth + 1, result);
    }
  }

  return result;
}

function chapterForPage(outline: TocItem[], page: number) {
  let current: TocItem | undefined;
  outline.forEach((item) => {
    if (item.page !== undefined && item.page <= page) {
      if (!current || item.page >= (current.page ?? 0)) current = item;
    }
  });
  return current?.label;
}

/* Highlights in fixed-layout PDFs are anchored with character offsets inside the
   page's text layer: "pdf:<page>:<start>:<end>". The text content is identical
   at every zoom level, so the offsets survive re-renders. */
const PDF_RANGE_PATTERN = /^pdf:(\d+):(\d+):(\d+)$/;

function textNodesIn(root: Node): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node: Node | null = walker.nextNode();
  while (node) {
    if (node.nodeValue) nodes.push(node as Text);
    node = walker.nextNode();
  }
  return nodes;
}

function rangeFromOffsets(
  root: Node,
  start: number,
  end: number,
): Range | null {
  if (end <= start) return null;
  const nodes = textNodesIn(root);
  let total = 0;
  let startNode: Text | null = null;
  let startOffset = 0;
  let endNode: Text | null = null;
  let endOffset = 0;

  for (const node of nodes) {
    const length = node.nodeValue?.length ?? 0;
    if (!startNode && start <= total + length) {
      startNode = node;
      startOffset = Math.max(0, start - total);
    }
    if (end <= total + length) {
      endNode = node;
      endOffset = Math.max(0, end - total);
      break;
    }
    total += length;
  }

  if (!startNode || !endNode) return null;
  const range = document.createRange();
  try {
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
  } catch {
    return null;
  }
  return range;
}

export const PdfView = forwardRef<ReaderViewHandle, ReaderViewProps>(
  function PdfView(
    {
      bookId,
      file,
      title,
      local,
      pdfFit = "page",
      initialTarget,
      preferences,
      highlights,
      onReady,
      onLocation,
      onSelection,
      onHighlightClick,
      onError,
    },
    ref,
  ) {
    const stageRef = useRef<HTMLDivElement>(null);
    const frameRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const textLayerRef = useRef<HTMLDivElement>(null);
    const highlightLayerRef = useRef<HTMLDivElement>(null);
    const pdfRef = useRef<PDFDocumentProxy | null>(null);
    const pdfjsRef = useRef<typeof import("pdfjs-dist") | null>(null);
    const textLayerCancelRef = useRef<(() => void) | null>(null);
    const textCacheRef = useRef<{ page: number; content: PdfTextContent } | null>(
      null,
    );
    const resizeTimerRef = useRef<number | null>(null);
    const outlineRef = useRef<TocItem[]>([]);
    const requestedPage = useRef<number | null>(initialTarget.page ?? null);
    const requestedPercent = useRef<number | null>(
      initialTarget.percent ?? null,
    );

    const [ready, setReady] = useState(false);
    const [numPages, setNumPages] = useState(0);
    const [page, setPage] = useState(1);
    const [zoom, setZoom] = useState(1);
    const [viewportTick, setViewportTick] = useState(0);
    const [textLayerTick, setTextLayerTick] = useState(0);

    const pageRef = useRef(page);
    pageRef.current = page;

    const onReadyRef = useRef(onReady);
    const onLocationRef = useRef(onLocation);
    const onErrorRef = useRef(onError);
    const onSelectionRef = useRef(onSelection);
    const onHighlightClickRef = useRef(onHighlightClick);
    const highlightsRef = useRef(highlights);
    const preferencesRef = useRef(preferences);
    onReadyRef.current = onReady;
    onLocationRef.current = onLocation;
    onErrorRef.current = onError;
    onSelectionRef.current = onSelection;
    onHighlightClickRef.current = onHighlightClick;
    highlightsRef.current = highlights;
    preferencesRef.current = preferences;

    useEffect(() => {
      onSelection(null);
    }, [onSelection]);

    useEffect(() => {
      let cancelled = false;
      let loadingTask: { destroy: () => Promise<void> } | null = null;

      const load = async () => {
        try {
          const [pdfjs, worker] = await Promise.all([
            import("pdfjs-dist"),
            import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
          ]);
          if (cancelled) return;

          pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
          pdfjsRef.current = pdfjs;
          let source;
          if (local) {
            const blob = await loadPdfFile(bookId);
            if (!blob) throw new Error("missing-local-pdf");
            source = { data: new Uint8Array(await blob.arrayBuffer()) };
          } else {
            source = {
              url: `${import.meta.env.BASE_URL}books/${file}`,
            };
          }
          const task = pdfjs.getDocument(source);
          loadingTask = task;
          const pdf = await task.promise;
          if (cancelled) {
            await task.destroy();
            return;
          }

          pdfRef.current = pdf;
          setNumPages(pdf.numPages);

          let outline: TocItem[] = [];
          try {
            const rawOutline = await pdf.getOutline();
            outline = await resolveOutline(
              pdf,
              rawOutline as PdfOutlineNode[] | null,
            );
          } catch {
            outline = [];
          }
          if (cancelled) return;
          outlineRef.current = outline;

          let initialPage = requestedPage.current;
          if (initialPage == null && requestedPercent.current != null) {
            initialPage = Math.max(
              1,
              Math.min(
                pdf.numPages,
                Math.ceil(requestedPercent.current * pdf.numPages),
              ),
            );
          }
          if (initialPage == null) initialPage = 1;

          const safePage = Math.max(1, Math.min(pdf.numPages, initialPage));
          setPage(safePage);
          setReady(true);
          onReadyRef.current(outline);
        } catch (error) {
          if (cancelled) return;
          const message =
            error instanceof Error ? error.message : "Unknown PDF error";
          if (message === "missing-local-pdf") {
            onErrorRef.current(
              "This imported PDF is no longer stored in this browser. Add it again from your library.",
            );
          } else {
            onErrorRef.current(
              `This PDF could not be opened. ${message ? `(${message})` : ""}`,
            );
          }
        }
      };

      void load();

      return () => {
        cancelled = true;
        pdfRef.current = null;
        textCacheRef.current = null;
        setReady(false);
        if (loadingTask) void loadingTask.destroy();
      };
      // The edition is intentionally opened once per title.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bookId, file]);

    useEffect(() => {
      const stage = stageRef.current;
      if (!stage) return;
      const observer = new ResizeObserver(() => {
        // Let the scrollbar settle before re-fitting the page.
        if (resizeTimerRef.current !== null) {
          window.clearTimeout(resizeTimerRef.current);
        }
        resizeTimerRef.current = window.setTimeout(() => {
          resizeTimerRef.current = null;
          setViewportTick((tick) => tick + 1);
        }, 160);
      });
      observer.observe(stage);
      return () => {
        observer.disconnect();
        if (resizeTimerRef.current !== null) {
          window.clearTimeout(resizeTimerRef.current);
          resizeTimerRef.current = null;
        }
      };
    }, []);

    /* Draw the saved highlights for the current page under/over the text layer. */
    const paintHighlights = useCallback(() => {
      const layer = highlightLayerRef.current;
      const textLayerEl = textLayerRef.current;
      const frameEl = frameRef.current;
      if (!layer || !textLayerEl || !frameEl) return;

      layer.replaceChildren();
      const base = frameEl.getBoundingClientRect();

      for (const highlight of highlightsRef.current) {
        const match = PDF_RANGE_PATTERN.exec(highlight.cfiRange ?? "");
        if (!match || Number(match[1]) !== pageRef.current) continue;

        const range = rangeFromOffsets(
          textLayerEl,
          Number(match[2]),
          Number(match[3]),
        );
        if (!range) continue;

        const { fill } = highlightColors[highlight.color] ?? {
          fill: "#c8aa69",
        };

        for (const rect of range.getClientRects()) {
          if (rect.width < 1 || rect.height < 1) continue;
          const marker = document.createElement("div");
          marker.className = "reader-pdf-highlight";
          marker.setAttribute("role", "button");
          marker.tabIndex = -1;
          marker.setAttribute(
            "aria-label",
            `Highlight: ${highlight.text.slice(0, 60)}`,
          );
          marker.style.left = `${rect.left - base.left}px`;
          marker.style.top = `${rect.top - base.top}px`;
          marker.style.width = `${rect.width}px`;
          marker.style.height = `${rect.height}px`;
          marker.style.backgroundColor = fill;
          marker.addEventListener("click", () => {
            onHighlightClickRef.current(highlight);
          });
          layer.appendChild(marker);
        }
      }
    }, []);

    /* Native selection inside the text layer becomes a highlight candidate. */
    useEffect(() => {
      let active = false;

      const handleSelectionChange = () => {
        const textLayerEl = textLayerRef.current;
        const selection = window.getSelection();
        if (!textLayerEl || !selection) return;

        if (selection.rangeCount === 0 || selection.isCollapsed) {
          if (active) {
            active = false;
            onSelectionRef.current(null);
          }
          return;
        }

        const range = selection.getRangeAt(0);
        if (!textLayerEl.contains(range.commonAncestorContainer)) return;

        const text = selection.toString().replace(/\s+/g, " ").trim();
        if (!text) return;

        // Measure offsets against the whole text layer so element containers
        // (whole-line selections) still resolve to a character range.
        const prefix = document.createRange();
        prefix.selectNodeContents(textLayerEl);
        prefix.setEnd(range.startContainer, range.startOffset);
        const start = prefix.toString().length;
        prefix.setEnd(range.endContainer, range.endOffset);
        const end = prefix.toString().length;
        if (end <= start) return;

        const bounds = range.getBoundingClientRect();
        active = true;
        onSelectionRef.current({
          cfiRange: `pdf:${pageRef.current}:${start}:${end}`,
          text: text.slice(0, 6000),
          chapter: chapterForPage(outlineRef.current, pageRef.current),
          rect: {
            top: bounds.top,
            left: bounds.left,
            width: bounds.width,
            height: bounds.height,
          },
        });
      };

      document.addEventListener("selectionchange", handleSelectionChange);
      return () =>
        document.removeEventListener("selectionchange", handleSelectionChange);
    }, []);

    useEffect(() => {
      if (ready) paintHighlights();
    }, [
      ready,
      page,
      zoom,
      viewportTick,
      textLayerTick,
      highlights,
      paintHighlights,
    ]);

    useEffect(() => {
      if (!ready) return;
      const pdf = pdfRef.current;
      const canvas = canvasRef.current;
      const stage = stageRef.current;
      if (!pdf || !canvas || !stage) return;

      let disposed = false;
      let renderTask: RenderTask | null = null;

      const render = async () => {
        const pdfPage = await pdf.getPage(page);
        if (disposed) return;

        const availableWidth = Math.max(240, stage.clientWidth - 32);
        const availableHeight = Math.max(240, stage.clientHeight - 32);
        const base = pdfPage.getViewport({ scale: 1 });
        const fit =
          pdfFit === "width"
            ? availableWidth / base.width
            : Math.min(
                availableWidth / base.width,
                availableHeight / base.height,
              );
        const scale = Math.max(0.15, fit * zoom);
        const viewport = pdfPage.getViewport({ scale });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);

        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const context = canvas.getContext("2d", { alpha: false });
        if (!context) return;
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);

        renderTask = pdfPage.render({
          canvasContext: context,
          viewport,
          transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
        });
        await renderTask.promise;
        if (disposed) return;

        const location: ReaderLocation = {
          percent: pdf.numPages > 0 ? page / pdf.numPages : 0,
          page,
          pageLabel: `${page} / ${pdf.numPages}`,
          chapter: chapterForPage(outlineRef.current, page),
          atStart: page <= 1,
          atEnd: page >= pdf.numPages,
          zoom,
        };
        onLocationRef.current(location);

        const textLayerEl = textLayerRef.current;
        const pdfjs = pdfjsRef.current;
        if (!textLayerEl || !pdfjs) return;

        textLayerCancelRef.current?.();
        textLayerEl.replaceChildren();
        textLayerEl.style.setProperty("--scale-factor", String(viewport.scale));

        if (!textCacheRef.current || textCacheRef.current.page !== page) {
          textCacheRef.current = {
            page,
            content: await pdfPage.getTextContent(),
          };
          if (disposed) return;
        }

        const cachedText = textCacheRef.current;
        if (!cachedText) return;

        const textLayer: TextLayer = new pdfjs.TextLayer({
          textContentSource: cachedText.content,
          container: textLayerEl,
          viewport,
        });
        textLayerCancelRef.current = () => textLayer.cancel();
        await textLayer.render();
        if (disposed) return;
        setTextLayerTick((tick) => tick + 1);
      };

      void render().catch((error: unknown) => {
        const name =
          error && typeof error === "object" && "name" in error
            ? String((error as { name: unknown }).name)
            : "";
        if (name !== "RenderingCancelledException" && !disposed) {
          onErrorRef.current("This page could not be rendered.");
        }
      });

      return () => {
        disposed = true;
        try {
          renderTask?.cancel();
        } catch {
          /* render already finished */
        }
        textLayerCancelRef.current?.();
        textLayerCancelRef.current = null;
      };
    }, [ready, page, zoom, numPages, viewportTick, pdfFit]);

    useEffect(() => {
      stageRef.current?.scrollTo({ top: 0 });
    }, [page, pdfFit]);

    useEffect(() => {
      if (!ready) return;
      onSelection(null);
    }, [page, ready, onSelection]);

    // The document is intentionally fixed-layout; theme is applied with a canvas filter in reader.css.

    useImperativeHandle(
      ref,
      () => ({
        next: () => setPage((current) => Math.min(numPages, current + 1)),
        prev: () => setPage((current) => Math.max(1, current - 1)),
        goTo: (target: ReaderTarget) => {
          if (target.cfi) {
            const match = PDF_RANGE_PATTERN.exec(target.cfi);
            if (match) {
              const targetPage = Number(match[1]);
              if (targetPage >= 1 && targetPage <= numPages) {
                setPage(targetPage);
                return;
              }
            }
          }
          if (target.page !== undefined) {
            setPage(Math.max(1, Math.min(numPages, target.page)));
            return;
          }
          if (target.percent !== undefined) {
            setPage(
              Math.max(
                1,
                Math.min(numPages, Math.ceil(target.percent * numPages)),
              ),
            );
          }
        },
        clearSelection: () => {
          window.getSelection()?.removeAllRanges();
          onSelection(null);
        },
        zoomIn: () => setZoom((current) => Math.min(3, +(current + 0.15).toFixed(2))),
        zoomOut: () =>
          setZoom((current) => Math.max(0.5, +(current - 0.15).toFixed(2))),
      }),
      [numPages, onSelection],
    );

    return (
      <div
        ref={stageRef}
        className="reader-pdf-stage h-full w-full overflow-auto"
        aria-label={`${title} — PDF reading view`}
      >
        <div className="flex min-h-full w-full items-start justify-center p-4 sm:p-7">
          <div ref={frameRef} className="reader-pdf-frame relative">
            <canvas
              ref={canvasRef}
              className="reader-pdf-canvas rounded-[2px]"
              aria-label={`Page ${page} of ${numPages}`}
            />
            <div
              ref={highlightLayerRef}
              className="reader-pdf-highlights"
              aria-hidden="true"
            />
            <div ref={textLayerRef} className="reader-pdf-textlayer" />
            {!ready ? (
              <div className="reader-pdf-scrim absolute inset-0 flex min-h-[20rem] min-w-[16rem] items-center justify-center rounded">
                <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#ded5c6] border-t-[#8a6d43]" />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  },
);
