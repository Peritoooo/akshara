import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  BookOpen,
  Bookmark,
  Check,
  Heart,
  Library,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useLibraryStore } from "@/store/library";
import type { Book, LibraryEntry, ReadingStatus } from "@/types";
import { cn, formatRelative, percentLabel } from "@/lib/utils";
import { BookCover } from "./BookCover";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { IconButton } from "@/components/ui/Button";
import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/Menu";
import { Dialog } from "@/components/ui/Dialog";

const statusOptions: Array<{
  status: ReadingStatus;
  label: string;
  icon: typeof BookOpen;
}> = [
  { status: "reading", label: "Reading", icon: BookOpen },
  { status: "want", label: "Want to read", icon: Bookmark },
  { status: "finished", label: "Finished", icon: Check },
];

export function BookMenu({
  book,
  entry,
  className,
}: {
  book: Book;
  entry?: LibraryEntry;
  className?: string;
}) {
  const navigate = useNavigate();
  const collections = useLibraryStore((state) => state.collections);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const handleStatus = (status: ReadingStatus) => {
    const store = useLibraryStore.getState();
    if (!entry) {
      store.addToLibrary(book.id, status);
    } else {
      store.setStatus(book.id, status);
    }
    toast.success(
      status === "finished"
        ? "Marked as finished"
        : status === "reading"
          ? "Moved to Currently Reading"
          : "Saved to Want to Read",
      { description: book.title },
    );
  };

  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <IconButton
            label={`More options for ${book.title}`}
            variant="surface"
            size="sm"
            className={cn(
              "h-8 w-8 border-line/60 bg-surface/90 shadow-soft backdrop-blur-md",
              className,
            )}
          >
            <MoreHorizontal className="h-4 w-4" />
          </IconButton>
        </MenuTrigger>
        <MenuContent className="min-w-[14rem]">
          <MenuItem
            icon={<BookOpen className="h-3.5 w-3.5" />}
            onSelect={() => navigate(`/read/${book.id}`)}
          >
            {entry?.status === "reading" ? "Continue reading" : "Start reading"}
          </MenuItem>
          <MenuItem
            icon={<ArrowUpRight className="h-3.5 w-3.5" />}
            onSelect={() => navigate(`/book/${book.id}`)}
          >
            View details
          </MenuItem>
          <MenuSeparator />
          <MenuLabel>Reading status</MenuLabel>
          {statusOptions.map((option) => (
            <MenuItem
              key={option.status}
              icon={<option.icon className="h-3.5 w-3.5" />}
              onSelect={() => handleStatus(option.status)}
            >
              <span className="flex w-full items-center justify-between">
                {option.label}
                {entry?.status === option.status ? (
                  <Check className="h-3.5 w-3.5 text-accent-strong" />
                ) : null}
              </span>
            </MenuItem>
          ))}
          <MenuSeparator />
          {entry ? (
            <MenuItem
              icon={
                <Heart
                  className={cn("h-3.5 w-3.5", entry.favorite && "fill-current text-rose")}
                />
              }
              onSelect={() => {
                useLibraryStore.getState().toggleFavorite(book.id);
                toast.success(
                  entry.favorite ? "Removed from favorites" : "Added to favorites",
                  { description: book.title },
                );
              }}
            >
              {entry.favorite ? "Remove from favorites" : "Add to favorites"}
            </MenuItem>
          ) : (
            <MenuItem
              icon={<Library className="h-3.5 w-3.5" />}
              onSelect={() => {
                useLibraryStore.getState().addToLibrary(book.id, "want");
                toast.success("Added to your library", { description: book.title });
              }}
            >
              Add to library
            </MenuItem>
          )}
          {collections.length > 0 && entry ? (
            <>
              <MenuSeparator />
              <MenuLabel>Collections</MenuLabel>
              {collections.map((collection) => (
                <MenuCheckboxItem
                  key={collection.id}
                  checked={entry.collections.includes(collection.id)}
                  onCheckedChange={() =>
                    useLibraryStore.getState().toggleCollection(book.id, collection.id)
                  }
                >
                  {collection.name}
                </MenuCheckboxItem>
              ))}
            </>
          ) : null}
          {entry ? (
            <>
              <MenuSeparator />
              <MenuItem
                icon={<Trash2 className="h-3.5 w-3.5" />}
                destructive
                onSelect={(event) => {
                  event.preventDefault();
                  setConfirmRemove(true);
                }}
              >
                {book.custom ? "Delete imported PDF" : "Remove from library"}
              </MenuItem>
            </>
          ) : null}
        </MenuContent>
      </Menu>

      <Dialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={book.custom ? "Delete this PDF?" : "Remove this book?"}
        description={
          book.custom
            ? `${book.title} and its local file will be removed from this browser.`
            : `${book.title} will leave your library, along with its bookmarks, highlights, and reading position.`
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => setConfirmRemove(false)}
              className="h-9 rounded-full px-4 text-[0.8125rem] font-medium text-ink-soft transition-colors hover:bg-muted hover:text-ink"
            >
              Keep it
            </button>
            <button
              type="button"
              onClick={() => {
                if (book.custom) {
                  useLibraryStore.getState().removeCustomBook(book.id);
                  toast("PDF removed", { description: book.title });
                } else {
                  useLibraryStore.getState().removeFromLibrary(book.id);
                  toast("Removed from your library", { description: book.title });
                }
                setConfirmRemove(false);
              }}
              className="h-9 rounded-full bg-rose px-4 text-[0.8125rem] font-medium text-white transition-opacity hover:opacity-90"
            >
              {book.custom ? "Delete PDF" : "Remove book"}
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-muted">
          {book.custom
            ? "This file is stored only in this browser. Deleting it cannot be undone, and you would need to add the PDF again."
            : "This title will leave your library. Your reading history for it will not be recovered."}
        </p>
      </Dialog>
    </>
  );
}

interface BookCardProps {
  book: Book;
  entry?: LibraryEntry;
  progress?: number;
  className?: string;
  showMenu?: boolean;
  priority?: boolean;
}

export function BookCard({
  book,
  entry,
  progress,
  className,
  showMenu = true,
}: BookCardProps) {
  const readingProgress = progress ?? entry?.progress ?? 0;
  return (
    <article className={cn("group relative min-w-0", className)}>
      <Link
        to={`/book/${book.id}`}
        className="block outline-none"
        aria-label={`${book.title} by ${book.author}`}
      >
        <div className="relative transition-transform duration-500 [transition-timing-function:var(--ease-out-soft)] group-hover:-translate-y-1.5">
          <BookCover book={book} />
          <div className="pointer-events-none absolute inset-0 z-[5] flex items-end justify-center rounded-[2px] bg-gradient-to-t from-black/55 via-black/0 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <span className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/25 px-3 py-1.5 text-[0.65rem] font-medium uppercase tracking-[0.12em] text-white backdrop-blur-md">
              {entry?.status === "reading" ? "Continue" : "Open book"}
              <ArrowUpRight className="h-3 w-3" />
            </span>
          </div>
          {entry?.favorite ? (
            <span className="absolute right-2.5 top-2.5 z-[6] flex h-7 w-7 items-center justify-center rounded-full bg-black/25 backdrop-blur-md">
              <Heart className="h-3.5 w-3.5 fill-white text-white" />
              <span className="sr-only">Favorite</span>
            </span>
          ) : null}
        </div>

        <div className="px-0.5 pt-3.5">
          <h3 className="line-clamp-2 font-display text-[0.975rem] leading-[1.25] tracking-[-0.012em] text-ink transition-colors group-hover:text-accent-strong">
            {book.title}
          </h3>
          <p className="mt-1 truncate text-[0.75rem] text-ink-muted">{book.author}</p>
          {entry?.status === "reading" ? (
            <div className="mt-2.5">
              <ProgressBar value={readingProgress} />
              <div className="mt-1.5 flex items-center justify-between text-[0.625rem] tabular-nums text-ink-muted">
                <span>{percentLabel(readingProgress)}</span>
                <span>{formatRelative(entry.lastOpenedAt)}</span>
              </div>
            </div>
          ) : entry?.status === "finished" ? (
            <p className="mt-2 text-[0.625rem] uppercase tracking-[0.12em] text-sage">
              Finished
            </p>
          ) : null}
        </div>
      </Link>
      {showMenu ? (
        <div className="absolute right-2 top-2 z-10 transition-opacity duration-200 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          <BookMenu book={book} entry={entry} />
        </div>
      ) : null}
    </article>
  );
}

export function BookGrid({
  books,
  entries,
  className,
}: {
  books: Book[];
  entries: Record<string, LibraryEntry>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5",
        className,
      )}
    >
      {books.map((book, index) => (
        <div
          key={book.id}
          className="tk-enter"
          style={{ animationDelay: `${Math.min(index * 45, 360)}ms` }}
        >
          <BookCard book={book} entry={entries[book.id]} />
        </div>
      ))}
    </div>
  );
}
