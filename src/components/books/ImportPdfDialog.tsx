import { useCallback, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import type { Book, CoverMotif } from "@/types";
import { savePdfFile } from "@/lib/pdfStore";
import { useLibraryStore } from "@/store/library";
import { Dialog } from "@/components/ui/Dialog";
import { TextInput } from "@/components/ui/Field";
import { buttonStyles } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface ParsedPdf {
  file: File;
  pages: number;
  coverImage: string;
  title: string;
  author: string;
}

const palettes = [
  { bg: "#3A3530", ink: "#F2EBDD", accent: "#C6A978" },
  { bg: "#5B4A3E", ink: "#F5EEDF", accent: "#D8B98C" },
  { bg: "#2F3938", ink: "#EDE8DC", accent: "#B9A789" },
  { bg: "#514148", ink: "#F4EAE3", accent: "#C9A0A0" },
  { bg: "#33404C", ink: "#EFE9DA", accent: "#BEAA83" },
];

const motifs: CoverMotif[] = [
  "arch",
  "sun",
  "waves",
  "botanical",
  "orbit",
  "lattice",
  "peaks",
  "flame",
  "feather",
  "keyhole",
  "moon",
  "deco",
];

function hash(text: string) {
  let value = 0;
  for (let index = 0; index < text.length; index += 1) {
    value = (value * 31 + text.charCodeAt(index)) >>> 0;
  }
  return value;
}

function titleFromFilename(name: string) {
  const cleaned = name
    .replace(/\.pdf$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "Untitled PDF";
  return cleaned.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}

async function readPdf(file: File): Promise<ParsedPdf> {
  if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
    throw new Error("Please choose a PDF file.");
  }
  if (file.size > 200 * 1024 * 1024) {
    throw new Error("This PDF is larger than 200 MB. Try a smaller copy.");
  }

  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data });
  try {
    const pdf = await task.promise;
    const pages = pdf.numPages;

    const firstPage = await pdf.getPage(1);
    const base = firstPage.getViewport({ scale: 1 });
    const scale = 320 / Math.max(1, base.width);
    const viewport = firstPage.getViewport({ scale });
    const ratio = 2;

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(viewport.width * ratio));
    canvas.height = Math.max(1, Math.floor(viewport.height * ratio));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare a cover for this PDF.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    await firstPage.render({
      canvasContext: context,
      viewport,
      transform: [ratio, 0, 0, ratio, 0, 0],
    }).promise;

    const coverImage = canvas.toDataURL("image/jpeg", 0.7);
    await pdf.destroy();

    return {
      file,
      pages,
      coverImage,
      title: titleFromFilename(file.name),
      author: "",
    };
  } catch (error) {
    void task.destroy();
    const message = error instanceof Error ? error.message : "";
    throw new Error(
      message && !/invalid|corrupt|missing/i.test(message)
        ? `This PDF could not be read. (${message})`
        : "This file does not look like a readable PDF.",
    );
  }
}

interface ImportPdfDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportPdfDialog({ open, onOpenChange }: ImportPdfDialogProps) {
  const navigate = useNavigate();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const addCustomBook = useLibraryStore((state) => state.addCustomBook);

  const [parsed, setParsed] = useState<ParsedPdf | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setParsed(null);
    setTitle("");
    setAuthor("");
    setBusy(false);
    setReading(false);
    setDragging(false);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    setError(null);
    try {
      const result = await readPdf(file);
      setParsed(result);
      setTitle(result.title);
      setAuthor(result.author);
    } catch (cause) {
      setParsed(null);
      setError(
        cause instanceof Error
          ? cause.message
          : "This PDF could not be read. Try another file.",
      );
    } finally {
      setReading(false);
    }
  }, []);

  const handleImport = async () => {
    if (!parsed || busy) return;
    const cleanTitle = title.trim() || parsed.title;
    const cleanAuthor = author.trim() || "Personal document";
    const id = `imported-${crypto.randomUUID()}`;
    const seed = hash(`${cleanTitle}${cleanAuthor}`);
    const palette = palettes[seed % palettes.length];

    const book: Book = {
      id,
      title: cleanTitle,
      author: cleanAuthor,
      description: `A personal PDF kept close — ${parsed.pages} ${
        parsed.pages === 1 ? "page" : "pages"
      }, added to your reading room on ${new Date().toLocaleDateString(
        "en-US",
        { month: "long", day: "numeric", year: "numeric" },
      )}.`,
      genres: ["Personal PDF"],
      year: new Date().getFullYear(),
      pages: parsed.pages,
      language: "Personal",
      format: "pdf",
      file: "",
      cover: palette,
      motif: motifs[seed % motifs.length],
      publisher: "Personal PDF · kept on this device",
      addedAt: new Date().toISOString(),
      custom: true,
      coverImage: parsed.coverImage,
    };

    setBusy(true);
    setError(null);
    try {
      await savePdfFile(id, parsed.file);
      addCustomBook(book);
      toast.success("PDF added to your library", {
        description: `${cleanTitle} · ${parsed.pages} ${
          parsed.pages === 1 ? "page" : "pages"
        }`,
      });
      handleOpenChange(false);
      navigate(`/read/${id}`);
    } catch (cause) {
      setError(
        cause instanceof Error && /quota|storage/i.test(cause.message)
          ? "This device is out of storage for PDFs. Remove an imported PDF, then try again."
          : "The PDF could not be saved on this device. Try a smaller file.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Add a PDF to your reading room"
      description="Choose a PDF from your device. It stays on this device — nothing is uploaded."
      className="max-w-xl"
      footer={
        <>
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            className="h-9 rounded-full px-4 text-[0.8125rem] font-medium text-ink-soft transition-colors hover:bg-muted hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={!parsed || busy}
            className={buttonStyles("primary", "sm")}
          >
            {busy ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Adding…
              </>
            ) : (
              <>
                <FileText className="h-3.5 w-3.5" />
                Add &amp; read
              </>
            )}
          </button>
        </>
      }
    >
      {!parsed ? (
        <div className="space-y-4">
          <label
            htmlFor={inputId}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              void handleFile(event.dataTransfer.files?.[0]);
            }}
            className={cn(
              "flex min-h-[13.5rem] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-10 text-center transition-colors focus-within:ring-2 focus-within:ring-accent/40",
              dragging
                ? "border-accent-strong bg-accent/10"
                : "border-line-strong bg-canvas hover:border-accent-strong/70 hover:bg-muted/50",
            )}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface text-accent-strong shadow-soft">
              {reading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Upload className="h-5 w-5" />
              )}
            </span>
            <span className="mt-4 font-display text-[1.05rem] tracking-[-0.01em] text-ink">
              {reading
                ? "Preparing your PDF…"
                : dragging
                  ? "Drop the PDF here"
                  : "Choose a PDF, or drop it here"}
            </span>
            <span className="mt-1.5 max-w-sm text-[0.75rem] leading-relaxed text-ink-muted">
              We make a soft cover from the first page and keep the whole file
              offline on this device.
            </span>
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              onChange={(event) => void handleFile(event.target.files?.[0])}
            />
          </label>

          {error ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose/25 bg-rose/5 px-3.5 py-3 text-[0.75rem] leading-relaxed text-rose"
            >
              <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          ) : (
            <p className="text-center text-[0.65rem] uppercase tracking-[0.16em] text-ink-muted">
              PDF · stored locally · private by default
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex gap-4 rounded-2xl border border-line bg-canvas p-3.5">
            <img
              src={parsed.coverImage}
              alt=""
              className="h-[8.5rem] w-[6.375rem] shrink-0 rounded-[2px] border border-line object-cover shadow-soft"
            />
            <div className="min-w-0 flex-1">
              <p className="eyebrow">Ready to shelve</p>
              <p className="mt-2 truncate font-display text-[1.05rem] tracking-[-0.01em] text-ink">
                {title || parsed.title}
              </p>
              <p className="mt-1 text-[0.7rem] text-ink-muted">
                {parsed.pages} {parsed.pages === 1 ? "page" : "pages"} ·{" "}
                {(parsed.file.size / (1024 * 1024)).toFixed(1)} MB
              </p>
              <button
                type="button"
                onClick={reset}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[0.7rem] font-medium text-ink-muted transition-colors hover:text-ink"
              >
                <X className="h-3 w-3" />
                Choose another
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs text-ink-muted">Title</span>
              <TextInput
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
                autoFocus
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs text-ink-muted">
                Author <span className="text-ink-muted/70">(optional)</span>
              </span>
              <TextInput
                value={author}
                onChange={(event) => setAuthor(event.target.value)}
                placeholder="Personal document"
                maxLength={80}
              />
            </label>
          </div>

          {error ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose/25 bg-rose/5 px-3.5 py-3 text-[0.75rem] leading-relaxed text-rose"
            >
              <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          ) : (
            <p className="text-[0.7rem] leading-relaxed text-ink-muted">
              Your PDF is stored offline on this device. Clearing app data or
              resetting the library removes imported files.
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}
