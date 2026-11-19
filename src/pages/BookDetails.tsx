import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bookmark as BookmarkIcon,
  BookOpen,
  Clock3,
  Feather,
  Heart,
  Highlighter,
  Library,
  Plus,
  Quote,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { books, estimatedMinutes } from "@/data/books";
import { useBook } from "@/hooks/useCatalog";
import { useLibraryStore } from "@/store/library";
import type { Book } from "@/types";
import { cn, formatDate, formatMinutes, percentLabel } from "@/lib/utils";
import { BookCover } from "@/components/books/BookCover";
import { BookCard, BookMenu } from "@/components/books/BookCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Button, IconButton, buttonStyles } from "@/components/ui/Button";
import {
  Badge,
  EmptyState,
  SectionHeading,
  SegmentedControl,
  StatusBadge,
} from "@/components/ui/Misc";
import { Dialog } from "@/components/ui/Dialog";

type DetailTab = "about" | "highlights" | "bookmarks";

const highlightTone: Record<string, string> = {
  gold: "bg-accent/30",
  sage: "bg-sage/25",
  rose: "bg-rose/25",
  sky: "bg-sky/25",
};

export function BookDetailsPage() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const book = useBook(bookId);
  const entry = useLibraryStore((state) =>
    bookId ? state.entries[bookId] : undefined,
  );
  const entries = useLibraryStore((state) => state.entries);
  const position = useLibraryStore((state) =>
    bookId ? state.positions[bookId] : undefined,
  );
  const allHighlights = useLibraryStore((state) => state.highlights);
  const allBookmarks = useLibraryStore((state) => state.bookmarks);
  const highlights = useMemo(
    () =>
      bookId
        ? allHighlights.filter((highlight) => highlight.bookId === bookId)
        : [],
    [allHighlights, bookId],
  );
  const bookmarks = useMemo(
    () =>
      bookId
        ? allBookmarks.filter((bookmark) => bookmark.bookId === bookId)
        : [],
    [allBookmarks, bookId],
  );
  const toggleFavorite = useLibraryStore((state) => state.toggleFavorite);
  const addToLibrary = useLibraryStore((state) => state.addToLibrary);
  const removeHighlight = useLibraryStore((state) => state.removeHighlight);
  const removeBookmark = useLibraryStore((state) => state.removeBookmark);
  const [tab, setTab] = useState<DetailTab>("about");
  const [deleteHighlight, setDeleteHighlight] = useState<string | null>(null);

  const related = useMemo(() => {
    if (!book) return [];
    return books
      .filter(
        (candidate) =>
          candidate.id !== book.id &&
          (candidate.author === book.author ||
            candidate.genres.some((genre) => book.genres.includes(genre))),
      )
      .slice(0, 5);
  }, [book]);

  if (!book) {
    return (
      <div className="page-wrap py-20">
        <EmptyState
          icon={<Library className="h-6 w-6" />}
          title="This edition is not on the shelf"
          description="The book you are looking for may have been removed, or the link may be incomplete."
          action={
            <Link to="/library" className={buttonStyles("primary", "md")}>
              Return to library
            </Link>
          }
        />
      </div>
    );
  }

  const progress = position?.percent ?? entry?.progress ?? 0;
  const reading = entry?.status === "reading";
  const finished = entry?.status === "finished";
  const readHref = finished
    ? `/read/${book.id}?from=start`
    : `/read/${book.id}`;
  const resumeHref = `/read/${book.id}`;

  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[26rem] opacity-80"
        style={{
          backgroundImage: `radial-gradient(70% 100% at 30% 0%, ${book.cover.accent}22, transparent 75%), linear-gradient(180deg, ${book.cover.bg}10, transparent 90%)`,
        }}
      />
      <div className="page-wrap relative pb-16 pt-7 lg:pt-9">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="group flex items-center gap-2 text-[0.75rem] font-medium text-ink-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back
          </button>
          <div className="flex items-center gap-2">
            <Badge>{book.format.toUpperCase()} edition</Badge>
            <BookMenu book={book} entry={entry} />
          </div>
        </div>

        <div className="mt-9 grid gap-9 md:grid-cols-[13rem_1fr] lg:grid-cols-[15.5rem_1fr] lg:gap-14">
          {/* Cover */}
          <div className="mx-auto w-[11.5rem] sm:w-[13rem] md:mx-0 md:w-full">
            <div className="relative">
              <BookCover book={book} />
              <div className="pointer-events-none absolute -bottom-5 left-[8%] right-[8%] h-8 rounded-[50%] bg-ink/20 blur-xl dark:bg-black/50" />
            </div>
            <div className="mt-7 hidden gap-2 md:flex">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={() => {
                  toggleFavorite(book.id);
                  toast.success(
                    entry?.favorite ? "Removed from favorites" : "Added to favorites",
                    { description: book.title },
                  );
                }}
              >
                <Heart
                  className={cn("h-3.5 w-3.5", entry?.favorite && "fill-rose text-rose")}
                />
                {entry?.favorite ? "Favorited" : "Favorite"}
              </Button>
              {!entry ? (
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    addToLibrary(book.id, "want");
                    toast.success("Added to your library", { description: book.title });
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              ) : null}
            </div>
          </div>

          {/* Details */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[0.625rem] font-medium uppercase tracking-[0.18em] text-accent-strong">
                {book.genres[0]}
              </span>
              <span className="h-1 w-1 rounded-full bg-line-strong" />
              <span className="text-[0.7rem] text-ink-muted">{book.year}</span>
              {entry ? (
                <>
                  <span className="h-1 w-1 rounded-full bg-line-strong" />
                  <StatusBadge status={entry.status} />
                </>
              ) : null}
            </div>
            <h1 className="display-title mt-3 max-w-3xl text-[clamp(2.1rem,4vw,3.5rem)] text-ink">
              {book.title}
            </h1>
            <p className="mt-2 font-display text-[1.05rem] italic text-ink-soft">
              by {book.author}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.75rem] text-ink-muted">
              <span className="flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5" />
                {formatMinutes(estimatedMinutes(book))} reading time
              </span>
              <span className="flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5" />
                {book.pages} pages
              </span>
              {book.rating ? (
                <span className="flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-accent-strong" />
                  {book.rating.toFixed(1)} / 5 editor rating
                </span>
              ) : null}
            </div>

            <p className="mt-6 max-w-2xl text-[0.9375rem] leading-[1.8] text-ink-soft">
              {book.description}
            </p>

            {reading ? (
              <div className="mt-7 max-w-lg rounded-xl border border-line bg-surface/80 p-4">
                <div className="flex items-center justify-between text-[0.7rem]">
                  <span className="font-medium text-ink">
                    {percentLabel(progress)} read
                  </span>
                  <span className="text-ink-muted">
                    {formatMinutes(
                      Math.max(3, Math.round(estimatedMinutes(book) * (1 - progress))),
                    )}{" "}
                    left
                  </span>
                </div>
                <ProgressBar value={progress} className="mt-2.5" size="sm" />
                <p className="mt-2 text-[0.65rem] text-ink-muted">
                  {position?.location
                    ? "Your exact place is saved on this device."
                    : "Your reading position will be saved as you read."}
                </p>
              </div>
            ) : null}

            <div className="mt-7 flex flex-wrap items-center gap-2.5">
              <Link to={readHref} className={buttonStyles("primary", "md")}>
                <BookOpen className="h-4 w-4" />
                {reading
                  ? "Continue reading"
                  : finished
                    ? "Read again"
                    : entry
                      ? "Start reading"
                      : "Read this edition"}
              </Link>
              {entry ? (
                <Link
                  to={resumeHref}
                  className={buttonStyles("secondary", "md", "hidden sm:inline-flex")}
                >
                  {finished ? "Return to last page" : "Open reader"}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => {
                    addToLibrary(book.id, "want");
                    toast.success("Saved to Want to Read", {
                      description: book.title,
                    });
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Add to library
                </Button>
              )}
              <div className="flex items-center gap-1 md:hidden">
                <IconButton
                  label={entry?.favorite ? "Remove from favorites" : "Add to favorites"}
                  variant="surface"
                  onClick={() => {
                    toggleFavorite(book.id);
                    toast.success(
                      entry?.favorite ? "Removed from favorites" : "Added to favorites",
                    );
                  }}
                >
                  <Heart
                    className={cn("h-4 w-4", entry?.favorite && "fill-rose text-rose")}
                  />
                </IconButton>
              </div>
            </div>

            <div className="mt-7 flex flex-wrap gap-1.5">
              {book.genres.map((genre) => (
                <span
                  key={genre}
                  className="rounded-full border border-line bg-surface/60 px-2.5 py-1 text-[0.65rem] text-ink-muted"
                >
                  {genre}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-12 border-t border-line pt-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <SegmentedControl
              ariaLabel="Book information sections"
              value={tab}
              onChange={setTab}
              options={[
                { value: "about", label: "About this edition" },
                { value: "highlights", label: "Highlights", count: highlights.length },
                { value: "bookmarks", label: "Bookmarks", count: bookmarks.length },
              ]}
            />
            {tab === "highlights" ? (
              <p className="text-[0.7rem] text-ink-muted">
                Select text while reading to keep it here.
              </p>
            ) : null}
          </div>

          <div className="mt-8 grid gap-10 lg:grid-cols-[1.25fr_0.75fr]">
            <div>
              {tab === "about" ? (
                <div className="tk-fade">
                  <blockquote className="border-l border-accent pl-5">
                    <Quote className="h-4 w-4 text-accent-strong" />
                    <p className="mt-3 max-w-2xl font-display text-[1.35rem] italic leading-[1.55] tracking-[-0.015em] text-ink">
                      “{book.editorial}”
                    </p>
                    <footer className="mt-3 text-[0.625rem] uppercase tracking-[0.18em] text-ink-muted">
                      A note from the editors
                    </footer>
                  </blockquote>
                  <div className="mt-8 grid gap-x-10 gap-y-6 text-sm sm:grid-cols-2">
                    <div>
                      <h3 className="eyebrow">The book</h3>
                      <p className="mt-3 leading-[1.8] text-ink-soft">
                        {book.description}
                      </p>
                    </div>
                    <div>
                      <h3 className="eyebrow">This edition</h3>
                      <dl className="mt-3 space-y-2.5 text-[0.8125rem]">
                        <div className="flex justify-between gap-4 border-b border-line pb-2.5">
                          <dt className="text-ink-muted">Publisher</dt>
                          <dd className="text-right text-ink">{book.publisher}</dd>
                        </div>
                        <div className="flex justify-between gap-4 border-b border-line pb-2.5">
                          <dt className="text-ink-muted">Format</dt>
                          <dd className="text-ink">
                            {book.format === "epub" ? "EPUB 3 · reflowable" : "PDF · fixed layout"}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-4 border-b border-line pb-2.5">
                          <dt className="text-ink-muted">Language</dt>
                          <dd className="text-ink">{book.language}</dd>
                        </div>
                        <div className="flex justify-between gap-4 border-b border-line pb-2.5">
                          <dt className="text-ink-muted">Published</dt>
                          <dd className="text-ink">{book.year}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-ink-muted">Added to Akshara</dt>
                          <dd className="text-ink">{formatDate(book.addedAt)}</dd>
                        </div>
                      </dl>
                      <p className="mt-4 text-[0.65rem] leading-relaxed text-ink-muted">
                        This edition is stored in your local library. Reading
                        progress, notes, and bookmarks remain on this device.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {tab === "highlights" ? (
                <div className="tk-fade">
                  {highlights.length === 0 ? (
                    <EmptyState
                      icon={<Highlighter className="h-6 w-6" />}
                      title="No highlights yet"
                      description="Open the reader, select a passage that matters, and choose a color. It will be kept here, alongside any note you write."
                      action={
                        <Link to={`/read/${book.id}`} className={buttonStyles("secondary", "sm")}>
                          Open the reader
                        </Link>
                      }
                    />
                  ) : (
                    <div className="space-y-4">
                      {highlights.map((highlight) => (
                        <article
                          key={highlight.id}
                          className="group relative rounded-xl border border-line bg-surface p-5"
                        >
                          <span
                            className={cn(
                              "absolute left-0 top-5 h-8 w-[2px] rounded-full",
                              highlightTone[highlight.color] ?? "bg-accent",
                            )}
                          />
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              {highlight.chapter ? (
                                <p className="text-[0.6rem] uppercase tracking-[0.16em] text-ink-muted">
                                  {highlight.chapter}
                                </p>
                              ) : null}
                              <p className="mt-2 font-reading text-[1rem] leading-[1.75] text-ink">
                                “{highlight.text}”
                              </p>
                              {highlight.note ? (
                                <p className="mt-3 border-t border-line pt-3 text-[0.8rem] leading-relaxed text-ink-muted">
                                  <Feather className="mr-1.5 inline h-3 w-3 text-accent-strong" />
                                  {highlight.note}
                                </p>
                              ) : null}
                              <p className="mt-3 text-[0.625rem] text-ink-muted">
                                Saved {formatDate(highlight.createdAt)}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              {highlight.cfiRange ? (
                                <Link
                                  to={`/read/${book.id}?cfi=${encodeURIComponent(highlight.cfiRange)}`}
                                  aria-label="Open highlight in reader"
                                  className="rounded-full p-2 text-ink-muted transition-colors hover:bg-muted hover:text-ink"
                                >
                                  <ArrowUpRight className="h-3.5 w-3.5" />
                                </Link>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => setDeleteHighlight(highlight.id)}
                                aria-label="Delete highlight"
                                className="rounded-full p-2 text-ink-muted opacity-0 transition-all hover:bg-muted hover:text-rose group-hover:opacity-100"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {tab === "bookmarks" ? (
                <div className="tk-fade">
                  {bookmarks.length === 0 ? (
                    <EmptyState
                      icon={<BookmarkIcon className="h-6 w-6" />}
                      title="No bookmarks yet"
                      description="Bookmarks are for the passages you want to find again. Add one while reading with the bookmark control or ⌘B."
                      action={
                        <Link to={`/read/${book.id}`} className={buttonStyles("secondary", "sm")}>
                          Open the reader
                        </Link>
                      }
                    />
                  ) : (
                    <div className="divide-y divide-line rounded-xl border border-line bg-surface">
                      {bookmarks.map((bookmark) => (
                        <div
                          key={bookmark.id}
                          className="group flex items-center gap-3 px-4 py-3.5"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-accent-strong">
                            <BookmarkIcon className="h-3.5 w-3.5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[0.8125rem] text-ink">
                              {bookmark.label}
                            </p>
                            <p className="mt-0.5 text-[0.625rem] text-ink-muted">
                              {percentLabel(bookmark.percent)} through ·{" "}
                              {formatDate(bookmark.createdAt)}
                            </p>
                          </div>
                          <Link
                            to={
                              bookmark.location
                                ? `/read/${book.id}?cfi=${encodeURIComponent(bookmark.location)}`
                                : `/read/${book.id}?percent=${bookmark.percent}`
                            }
                            className="rounded-full p-2 text-ink-muted transition-colors hover:bg-muted hover:text-ink"
                            aria-label="Open bookmark"
                          >
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              removeBookmark(bookmark.id);
                              toast("Bookmark removed");
                            }}
                            aria-label="Delete bookmark"
                            className="rounded-full p-2 text-ink-muted opacity-0 transition-all hover:bg-muted hover:text-rose group-hover:opacity-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <aside className="space-y-5">
              <div className="rounded-xl border border-line bg-surface p-5">
                <h3 className="eyebrow">At a glance</h3>
                <div className="mt-4 flex items-center gap-4">
                  <div className="w-12 shrink-0">
                    <BookCover book={book} showEdition={false} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-display text-[0.95rem] text-ink">
                      {book.title}
                    </p>
                    <p className="mt-0.5 truncate text-[0.7rem] text-ink-muted">
                      {book.author}
                    </p>
                    <p className="mt-2 flex items-center gap-1 text-[0.65rem] text-ink-muted">
                      <Clock3 className="h-3 w-3" />
                      {book.pages} pages · {formatMinutes(estimatedMinutes(book))}
                    </p>
                  </div>
                </div>
                {entry ? (
                  <div className="mt-4 border-t border-line pt-3 text-[0.65rem] text-ink-muted">
                    In your library since {formatDate(entry.addedAt)}
                  </div>
                ) : null}
              </div>
              <div className="rounded-xl border border-dashed border-line-strong/70 p-5">
                <p className="quote font-reading text-[0.875rem] italic leading-relaxed text-ink-soft">
                  “A book is a device to ignite the imagination.”
                </p>
                <p className="mt-2 text-[0.6rem] uppercase tracking-[0.16em] text-ink-muted">
                  Alan Bennett
                </p>
              </div>
            </aside>
          </div>
        </div>

        {related.length > 0 ? (
          <section className="mt-16 border-t border-line pt-10">
            <SectionHeading
              eyebrow="Keep wandering"
              title="You may also like"
              description={`More ${book.genres[0].toLowerCase()} and books in a similar spirit.`}
            />
            <div className="mt-7 grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {related.map((candidate: Book) => (
                <BookCard
                  key={candidate.id}
                  book={candidate}
                  entry={entries[candidate.id]}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <Dialog
        open={Boolean(deleteHighlight)}
        onOpenChange={(open) => !open && setDeleteHighlight(null)}
        title="Delete this highlight?"
        description="The passage and any note attached to it will be removed from this device."
        footer={
          <>
            <button
              type="button"
              onClick={() => setDeleteHighlight(null)}
              className="h-9 rounded-full px-4 text-[0.8125rem] font-medium text-ink-soft transition-colors hover:bg-muted hover:text-ink"
            >
              Keep highlight
            </button>
            <button
              type="button"
              onClick={() => {
                if (deleteHighlight) removeHighlight(deleteHighlight);
                setDeleteHighlight(null);
                toast("Highlight removed");
              }}
              className="h-9 rounded-full bg-rose px-4 text-[0.8125rem] font-medium text-white hover:opacity-90"
            >
              Delete
            </button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">This action cannot be undone.</p>
      </Dialog>
    </div>
  );
}
