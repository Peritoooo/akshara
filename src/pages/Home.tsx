import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BookMarked,
  Clock3,
  Flame,
  TrendingUp,
  Upload,
} from "lucide-react";
import { useBookMap } from "@/hooks/useCatalog";
import { useLibraryStore } from "@/store/library";
import { useSettingsStore } from "@/store/settings";
import { getStats, getStreak, readingProgress } from "@/lib/stats";
import {
  cn,
  formatMinutes,
  formatRelative,
  greeting,
  pluralize,
} from "@/lib/utils";
import { BookCover } from "@/components/books/BookCover";
import { BookCard } from "@/components/books/BookCard";
import { ContinueCard } from "@/components/books/ContinueCard";
import { ImportPdfDialog } from "@/components/books/ImportPdfDialog";
import { buttonStyles } from "@/components/ui/Button";
import { SectionHeading, StatusBadge } from "@/components/ui/Misc";

function ReadingRhythm() {
  const sessions = useLibraryStore((state) => state.sessions);
  const entries = useLibraryStore((state) => state.entries);
  const stats = getStats(sessions, entries);
  const max = Math.max(...stats.week.map((day) => day.minutes), 1);

  return (
    <div className="rounded-xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Your rhythm</p>
          <p className="mt-2 font-display text-[1.45rem] leading-tight tracking-[-0.02em] text-ink">
            {formatMinutes(stats.weekMinutes)} this week
          </p>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-accent-soft/60 px-2.5 py-1 text-[0.625rem] font-medium text-accent-strong dark:bg-accent-soft">
          <Flame className="h-3 w-3" />
          {getStreak(sessions)} days
        </span>
      </div>

      <div className="mt-6 flex h-24 items-end gap-2">
        {stats.week.map((day) => {
          const isToday =
            day.date.toDateString() === new Date().toDateString();
          return (
            <div key={day.key} className="group flex flex-1 flex-col items-center gap-2">
              <div className="relative flex h-20 w-full items-end justify-center">
                <div
                  className={cn(
                    "w-full max-w-[1.65rem] rounded-t-[3px] transition-all duration-500",
                    day.minutes === 0
                      ? "h-1 bg-line"
                      : isToday
                        ? "bg-accent-strong"
                        : "bg-line-strong/70 group-hover:bg-accent/70",
                  )}
                  style={{
                    height: day.minutes
                      ? `${Math.max(8, (day.minutes / max) * 100)}%`
                      : undefined,
                  }}
                  title={`${day.label}: ${day.minutes} min`}
                />
              </div>
              <span
                className={cn(
                  "text-[0.5625rem] uppercase tracking-[0.08em]",
                  isToday ? "font-semibold text-ink" : "text-ink-muted",
                )}
              >
                {day.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4">
        <div>
          <p className="text-[0.625rem] uppercase tracking-[0.12em] text-ink-muted">
            Avg. session
          </p>
          <p className="mt-1 text-[0.8125rem] text-ink">
            {formatMinutes(stats.avgSession)}
          </p>
        </div>
        <div>
          <p className="text-[0.625rem] uppercase tracking-[0.12em] text-ink-muted">
            Books finished
          </p>
          <p className="mt-1 text-[0.8125rem] text-ink">{stats.finished}</p>
        </div>
      </div>
      <Link
        to="/stats"
        className="mt-4 inline-flex items-center gap-1.5 text-[0.7rem] font-medium text-accent-strong transition-opacity hover:opacity-75"
      >
        View reading statistics
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

export function HomePage() {
  const entries = useLibraryStore((state) => state.entries);
  const positions = useLibraryStore((state) => state.positions);
  const sessions = useLibraryStore((state) => state.sessions);
  const displayName = useSettingsStore((state) => state.displayName);
  const bookMap = useBookMap();
  const [importOpen, setImportOpen] = useState(false);

  const reading = Object.values(entries)
    .filter((entry) => entry.status === "reading")
    .sort(
      (a, b) =>
        new Date(b.lastOpenedAt ?? b.addedAt).getTime() -
        new Date(a.lastOpenedAt ?? a.addedAt).getTime(),
    )
    .map((entry) => bookMap.get(entry.bookId))
    .filter((book) => book !== undefined);

  const libraryBooks = Object.values(entries)
    .sort(
      (a, b) =>
        new Date(b.lastOpenedAt ?? b.addedAt).getTime() -
        new Date(a.lastOpenedAt ?? a.addedAt).getTime(),
    )
    .map((entry) => bookMap.get(entry.bookId))
    .filter((book) => book !== undefined)
    .slice(0, 6);

  const recentlyAdded = Object.values(entries)
    .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
    .slice(0, 3)
    .map((entry) => ({ entry, book: bookMap.get(entry.bookId) }))
    .filter((item) => item.book !== undefined);

  const stats = getStats(sessions, entries);
  const isEmpty = Object.keys(entries).length === 0;
  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="page-wrap pb-16 pt-9 lg:pt-12">
      {/* Greeting */}
      <header className="flex flex-wrap items-start justify-between gap-8">
        <div>
          <p className="eyebrow">{dateLabel}</p>
          <h1 className="display-title mt-3 text-[clamp(2.4rem,4.6vw,3.65rem)] text-ink">
            {greeting()}, <span className="text-accent-strong">{displayName}</span>.
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-muted">
            {reading.length > 0
              ? `${reading.length} ${pluralize(reading.length, "book")} in progress. A quiet hour is a good place to begin.`
              : "Your reading room is quiet and ready."}
          </p>
        </div>
        <div className="flex flex-col items-end gap-4">
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className={buttonStyles("primary", "sm")}
          >
            <Upload className="h-3.5 w-3.5" />
            Add a PDF
          </button>
          <div className="hidden items-center gap-7 border-l border-line pl-7 pt-1 md:flex">
            <div>
              <p className="flex items-center gap-1.5 text-[0.625rem] uppercase tracking-[0.14em] text-ink-muted">
                <Flame className="h-3 w-3 text-accent-strong" />
                Reading streak
              </p>
              <p className="mt-1 font-display text-[1.5rem] tracking-[-0.02em] text-ink">
                {stats.streak} days
              </p>
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-[0.625rem] uppercase tracking-[0.14em] text-ink-muted">
                <TrendingUp className="h-3 w-3 text-accent-strong" />
                This week
              </p>
              <p className="mt-1 font-display text-[1.5rem] tracking-[-0.02em] text-ink">
                {formatMinutes(stats.weekMinutes)}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* A quiet start */}
      {isEmpty ? (
        <section className="tk-enter mt-9 rounded-2xl border border-line bg-surface px-6 py-14 text-center sm:px-10 sm:py-16">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-line bg-canvas text-accent-strong shadow-soft">
            <Upload className="h-5 w-5" />
          </span>
          <h2 className="display-title mx-auto mt-6 max-w-lg text-[clamp(1.7rem,3vw,2.3rem)] text-ink">
            Bring in your first book
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-muted">
            Choose any PDF from your device. It stays on this device, gets a soft
            cover from its first page, and opens in a reading room built for long,
            comfortable hours.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className={buttonStyles("primary", "md")}
            >
              <Upload className="h-4 w-4" />
              Add a PDF
            </button>
            <Link to="/settings" className={buttonStyles("secondary", "md")}>
              Set your comfort defaults
            </Link>
          </div>
        </section>
      ) : null}

      {/* Continue reading */}
      {reading.length > 0 ? (
        <section className="mt-12">
          <SectionHeading
            eyebrow="Pick up where you left off"
            title="Continue reading"
            action={
              <Link
                to="/library"
                className="hidden items-center gap-1.5 text-[0.75rem] font-medium text-ink-muted transition-colors hover:text-ink sm:flex"
              >
                All in progress
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {reading.slice(0, 3).map((book) => {
              const entry = entries[book.id];
              return (
                <ContinueCard
                  key={book.id}
                  book={book}
                  entry={entry}
                  progress={readingProgress(entry, positions[book.id])}
                />
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Library shelf */}
      {!isEmpty ? (
        <section className="mt-14">
          <SectionHeading
            eyebrow="Your shelf"
            title="The library"
            description={`${Object.keys(entries).length} ${pluralize(Object.keys(entries).length, "book")} gathered, ${stats.finished} finished.`}
            action={
              <Link
                to="/library"
                className={buttonStyles("secondary", "sm", "hidden sm:inline-flex")}
              >
                Browse library
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <div className="mt-7 grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {libraryBooks.map((book, index) => (
              <div
                key={book.id}
                className="tk-enter"
                style={{ animationDelay: `${index * 55}ms` }}
              >
                <BookCard
                  book={book}
                  entry={entries[book.id]}
                  progress={readingProgress(entries[book.id], positions[book.id])}
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="group hidden flex-col items-center justify-center rounded-[2px] border border-dashed border-line-strong/70 text-center transition-colors hover:border-line-strong hover:bg-surface/60 xl:flex"
              style={{ aspectRatio: "2 / 3" }}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-ink-muted transition-colors group-hover:text-ink">
                <Upload className="h-4 w-4" />
              </span>
              <span className="mt-3 max-w-[7rem] text-[0.7rem] leading-relaxed text-ink-muted">
                Add a PDF
              </span>
            </button>
          </div>
          <Link
            to="/library"
            className="mt-7 inline-flex items-center gap-1.5 text-[0.75rem] font-medium text-ink-muted sm:hidden"
          >
            Browse library
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </section>
      ) : null}

      {/* Recently added + rhythm */}
      {!isEmpty ? (
        <section className="mt-14 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <SectionHeading
              eyebrow="New to the shelf"
              title="Recently added"
              action={
                <Link
                  to="/library?sort=added"
                  className="flex items-center gap-1.5 text-[0.75rem] font-medium text-ink-muted transition-colors hover:text-ink"
                >
                  See all
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              }
            />
            <div className="mt-5 divide-y divide-line border-y border-line">
              {recentlyAdded.map(({ book, entry }) => (
                <Link
                  key={book!.id}
                  to={`/book/${book!.id}`}
                  className="group flex items-center gap-4 py-3.5 transition-colors"
                >
                  <div className="w-10 shrink-0">
                    <BookCover book={book!} showEdition={false} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-[0.9rem] leading-snug tracking-[-0.01em] text-ink transition-colors group-hover:text-accent-strong">
                      {book!.title}
                    </p>
                    <p className="mt-0.5 truncate text-[0.7rem] text-ink-muted">
                      {book!.author} · Added {formatRelative(entry.addedAt).toLowerCase()}
                    </p>
                  </div>
                  <div className="hidden shrink-0 sm:block">
                    <StatusBadge status={entry.status} />
                  </div>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-ink-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
                </Link>
              ))}
            </div>
            <div className="mt-5 flex items-center gap-2 text-[0.6875rem] text-ink-muted">
              <BookMarked className="h-3.5 w-3.5" />
              <span>
                {Object.values(entries).filter((entry) => entry.status === "want").length}{" "}
                {pluralize(
                  Object.values(entries).filter((entry) => entry.status === "want").length,
                  "book",
                )}{" "}
                waiting on your list
              </span>
            </div>
          </div>
          <ReadingRhythm />
        </section>
      ) : null}

      <div className="mt-16 flex items-center justify-center gap-4 text-[0.625rem] uppercase tracking-[0.18em] text-ink-muted">
        <span className="h-px w-10 bg-line-strong" />
        <span className="flex items-center gap-1.5">
          <Clock3 className="h-3 w-3" />
          {formatMinutes(stats.totalMinutes)} read with Akshara
        </span>
        <span className="h-px w-10 bg-line-strong" />
      </div>

      <ImportPdfDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
