import { Link } from "react-router-dom";
import { ArrowRight, Clock3 } from "lucide-react";
import type { Book, LibraryEntry } from "@/types";
import { estimatedMinutes } from "@/data/books";
import { cn, formatMinutes, formatRelative, percentLabel } from "@/lib/utils";
import { BookCover } from "./BookCover";
import { ProgressBar } from "@/components/ui/ProgressBar";

export function ContinueCard({
  book,
  entry,
  progress,
  className,
}: {
  book: Book;
  entry: LibraryEntry;
  progress: number;
  className?: string;
}) {
  const minutesLeft = Math.max(
    3,
    Math.round((estimatedMinutes(book) * (1 - progress)) / 5) * 5,
  );

  return (
    <Link
      to={`/read/${book.id}`}
      className={cn(
        "group relative flex gap-4 overflow-hidden rounded-xl border border-line bg-surface p-4 transition-all duration-300 hover:border-line-strong hover:shadow-soft sm:gap-5 sm:p-5",
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(125deg, ${book.cover.bg}12, transparent 55%)`,
      }}
    >
      <div className="w-[4.7rem] shrink-0 sm:w-[5.5rem]">
        <BookCover book={book} showEdition={false} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col py-0.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[0.6rem] font-medium uppercase tracking-[0.18em] text-accent-strong">
            Continue reading
          </p>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line bg-surface/70 text-ink-muted transition-all duration-300 group-hover:border-transparent group-hover:bg-ink group-hover:text-canvas">
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
          </span>
        </div>
        <h3 className="mt-2 line-clamp-2 font-display text-[1.05rem] leading-[1.2] tracking-[-0.015em] text-ink sm:text-[1.15rem]">
          {book.title}
        </h3>
        <p className="mt-0.5 truncate text-[0.75rem] text-ink-muted">{book.author}</p>
        <div className="mt-auto pt-4">
          <div className="mb-1.5 flex items-center justify-between text-[0.65rem] text-ink-muted">
            <span className="flex items-center gap-1">
              <Clock3 className="h-3 w-3" />
              {formatMinutes(minutesLeft)} left
            </span>
            <span className="font-medium tabular-nums text-ink-soft">
              {percentLabel(progress)}
            </span>
          </div>
          <ProgressBar value={progress} />
          <p className="mt-1.5 text-[0.625rem] text-ink-muted">
            Last opened {formatRelative(entry.lastOpenedAt).toLowerCase()}
          </p>
        </div>
      </div>
    </Link>
  );
}
