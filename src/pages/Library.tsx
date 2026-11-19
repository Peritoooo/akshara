import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  FolderOpen,
  Heart,
  Library,
  Plus,
  SearchX,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useBookMap } from "@/hooks/useCatalog";
import { useLibraryStore } from "@/store/library";
import type { Book, LibraryEntry, ReadingStatus } from "@/types";
import { cn, pluralize } from "@/lib/utils";
import { BookGrid } from "@/components/books/BookCard";
import { ImportPdfDialog } from "@/components/books/ImportPdfDialog";
import { buttonStyles } from "@/components/ui/Button";
import { SearchField, SelectField, TextInput } from "@/components/ui/Field";
import {
  EmptyState,
  SegmentedControl,
  SectionHeading,
} from "@/components/ui/Misc";
import { Dialog } from "@/components/ui/Dialog";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
} from "@/components/ui/Menu";
import { IconButton } from "@/components/ui/Button";
import { MoreHorizontal } from "lucide-react";

type StatusFilter = "all" | ReadingStatus;

const statusSections: Array<{
  status: ReadingStatus;
  title: string;
  eyebrow: string;
  description: string;
}> = [
  {
    status: "reading",
    title: "Currently reading",
    eyebrow: "In progress",
    description: "Books with a bookmark still in them.",
  },
  {
    status: "want",
    title: "Want to read",
    eyebrow: "Waiting",
    description: "The shelf of possibility.",
  },
  {
    status: "finished",
    title: "Finished",
    eyebrow: "Completed",
    description: "Books that now live in memory.",
  },
];

export function LibraryPage() {
  const entries = useLibraryStore((state) => state.entries);
  const collections = useLibraryStore((state) => state.collections);
  const createCollection = useLibraryStore((state) => state.createCollection);
  const deleteCollection = useLibraryStore((state) => state.deleteCollection);

  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("all");
  const [author, setAuthor] = useState("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [newCollectionOpen, setNewCollectionOpen] = useState(false);
  const [collectionName, setCollectionName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const bookMap = useBookMap();

  const selectedCollectionId = params.get("collection");
  const selectedCollection = collections.find((c) => c.id === selectedCollectionId);
  const status = (params.get("status") as StatusFilter | null) ?? "all";
  const sort = params.get("sort") ?? "last-opened";

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (!value || value === "all" || (key === "sort" && value === "last-opened")) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setParams(next, { replace: true });
  };

  const libraryBooks = useMemo(() => {
    return Object.values(entries)
      .map((entry) => ({ entry, book: bookMap.get(entry.bookId) }))
      .filter((item): item is { entry: LibraryEntry; book: Book } => Boolean(item.book));
  }, [entries, bookMap]);

  const collectionBooks = useMemo(() => {
    if (!selectedCollectionId) return libraryBooks;
    return libraryBooks.filter((item) =>
      item.entry.collections.includes(selectedCollectionId),
    );
  }, [libraryBooks, selectedCollectionId]);

  const genres = useMemo(
    () =>
      Array.from(
        new Set(collectionBooks.flatMap((item) => item.book.genres)),
      ).sort(),
    [collectionBooks],
  );

  const authors = useMemo(
    () =>
      Array.from(new Set(collectionBooks.map((item) => item.book.author))).sort(),
    [collectionBooks],
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return collectionBooks.filter(({ book, entry }) => {
      if (favoritesOnly && !entry.favorite) return false;
      if (genre !== "all" && !book.genres.includes(genre)) return false;
      if (author !== "all" && book.author !== author) return false;
      if (
        term &&
        !`${book.title} ${book.author} ${book.genres.join(" ")}`
          .toLowerCase()
          .includes(term)
      ) {
        return false;
      }
      return true;
    });
  }, [collectionBooks, query, genre, author, favoritesOnly]);

  const sorted = useMemo(() => {
    const items = [...filtered];
    items.sort((a, b) => {
      switch (sort) {
        case "title":
          return a.book.title.localeCompare(b.book.title);
        case "author":
          return a.book.author.localeCompare(b.book.author);
        case "added":
          return (
            new Date(b.entry.addedAt).getTime() -
            new Date(a.entry.addedAt).getTime()
          );
        default:
          return (
            new Date(b.entry.lastOpenedAt ?? b.entry.addedAt).getTime() -
            new Date(a.entry.lastOpenedAt ?? a.entry.addedAt).getTime()
          );
      }
    });
    return items;
  }, [filtered, sort]);

  const countFor = (value: StatusFilter) => {
    const scoped = favoritesOnly
      ? filtered
      : collectionBooks.filter(({ book, entry }) => {
          if (genre !== "all" && !book.genres.includes(genre)) return false;
          if (author !== "all" && book.author !== author) return false;
          const term = query.trim().toLowerCase();
          if (
            term &&
            !`${book.title} ${book.author} ${book.genres.join(" ")}`
              .toLowerCase()
              .includes(term)
          ) {
            return false;
          }
          if (value === "all") return true;
          return entry.status === value;
        });
    return value === "all" ? scoped.length : scoped.filter(({ entry }) => entry.status === value).length;
  };

  const hasFilters = Boolean(query || genre !== "all" || author !== "all" || favoritesOnly);
  const activeBooks =
    status === "all" ? sorted : sorted.filter(({ entry }) => entry.status === status);

  const handleCreateCollection = () => {
    const name = collectionName.trim();
    if (!name) return;
    createCollection(name);
    setCollectionName("");
    setNewCollectionOpen(false);
    toast.success("Collection created", { description: name });
  };

  const handleDeleteCollection = () => {
    if (!deleteTarget) return;
    const collection = collections.find((c) => c.id === deleteTarget);
    deleteCollection(deleteTarget);
    setDeleteTarget(null);
    if (selectedCollectionId === deleteTarget) setParam("collection", null);
    toast("Collection deleted", { description: collection?.name });
  };

  const clearFilters = () => {
    setQuery("");
    setGenre("all");
    setAuthor("all");
    setFavoritesOnly(false);
  };

  const totalBooks = Object.keys(entries).length;

  return (
    <div className="page-wrap pb-16 pt-9 lg:pt-12">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="eyebrow">Your personal shelf</p>
          <h1 className="display-title mt-3 text-[clamp(2.3rem,4.2vw,3.4rem)] text-ink">
            {selectedCollection ? selectedCollection.name : "My Library"}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-muted">
            {selectedCollection
              ? selectedCollection.description ??
                "A collection from your shelf."
              : `${totalBooks} ${pluralize(totalBooks, "book")}, gathered across ${collections.length} ${pluralize(collections.length, "collection")}. Your reading, kept in one quiet place.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className={buttonStyles("primary", "sm")}
          >
            <Upload className="h-3.5 w-3.5" />
            Add PDF
          </button>
          <button
            type="button"
            onClick={() => setNewCollectionOpen(true)}
            className={buttonStyles("secondary", "sm")}
          >
            <Plus className="h-3.5 w-3.5" />
            New collection
          </button>
        </div>
      </header>

      {selectedCollection && selectedCollectionId ? (
        <div className="mt-7 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface px-4 py-3">
          <div className="flex items-center gap-2.5 text-[0.75rem] text-ink-muted">
            <FolderOpen className="h-4 w-4 text-accent-strong" />
            <span>
              Collection · {collectionBooks.length}{" "}
              {pluralize(collectionBooks.length, "book")}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Link
              to="/library"
              className="rounded-full px-3 py-1.5 text-[0.7rem] font-medium text-ink-muted transition-colors hover:bg-muted hover:text-ink"
            >
              Clear
            </Link>
            <Menu>
              <MenuTrigger asChild>
                <IconButton label="Collection options" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </IconButton>
              </MenuTrigger>
              <MenuContent>
                <MenuItem
                  destructive
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  onSelect={() => setDeleteTarget(selectedCollectionId)}
                >
                  Delete collection
                </MenuItem>
              </MenuContent>
            </Menu>
          </div>
        </div>
      ) : null}

      {totalBooks === 0 ? (
        <div className="mt-12">
          <EmptyState
            icon={<Library className="h-6 w-6" />}
            title="Your shelf is waiting"
            description="Your reading room starts with a single file. Bring in a PDF from your device and it becomes a book with a cover, a position, and a shelf of its own."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setImportOpen(true)}
                  className={buttonStyles("primary", "md")}
                >
                  <Upload className="h-4 w-4" />
                  Add a PDF
                </button>
              </div>
            }
          />
        </div>
      ) : (
        <>
          {/* Controls */}
          <div className="mt-8 space-y-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <SegmentedControl
                ariaLabel="Filter by reading status"
                value={status}
                onChange={(value) => setParam("status", value)}
                options={[
                  { value: "all", label: "All books", count: countFor("all") },
                  { value: "reading", label: "Reading", count: countFor("reading") },
                  { value: "want", label: "Want to read", count: countFor("want") },
                  { value: "finished", label: "Finished", count: countFor("finished") },
                ]}
              />
              <div className="flex flex-wrap items-center gap-2">
                <SearchField
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onClear={() => setQuery("")}
                  placeholder="Search your library"
                  aria-label="Search your library"
                  containerClassName="w-full sm:w-56"
                />
                <SelectField
                  label="Filter by genre"
                  value={genre}
                  onChange={(event) => setGenre(event.target.value)}
                  options={[
                    { value: "all", label: "All genres" },
                    ...genres.map((item) => ({ value: item, label: item })),
                  ]}
                  className="w-[8.5rem]"
                />
                <SelectField
                  label="Filter by author"
                  value={author}
                  onChange={(event) => setAuthor(event.target.value)}
                  options={[
                    { value: "all", label: "All authors" },
                    ...authors.map((item) => ({ value: item, label: item })),
                  ]}
                  className="w-[8.5rem]"
                />
                <SelectField
                  label="Sort library"
                  value={sort}
                  onChange={(event) => setParam("sort", event.target.value)}
                  options={[
                    { value: "last-opened", label: "Last opened" },
                    { value: "added", label: "Recently added" },
                    { value: "title", label: "Title A–Z" },
                    { value: "author", label: "Author A–Z" },
                  ]}
                  className="w-[9.5rem]"
                />
                <button
                  type="button"
                  onClick={() => setFavoritesOnly((value) => !value)}
                  aria-pressed={favoritesOnly}
                  className={cn(
                    "flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-[0.75rem] font-medium transition-colors",
                    favoritesOnly
                      ? "border-rose/30 bg-rose/10 text-rose"
                      : "border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink",
                  )}
                >
                  <Heart className={cn("h-3.5 w-3.5", favoritesOnly && "fill-current")} />
                  Favorites
                </button>
              </div>
            </div>
            {hasFilters ? (
              <div className="flex items-center gap-3 text-[0.7rem] text-ink-muted">
                <span>
                  {activeBooks.length} {pluralize(activeBooks.length, "book")} shown
                </span>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="font-medium text-accent-strong hover:underline"
                >
                  Clear filters
                </button>
              </div>
            ) : null}
          </div>

          {activeBooks.length === 0 ? (
            <div className="mt-10">
              <EmptyState
                icon={favoritesOnly ? <Heart className="h-6 w-6" /> : <SearchX className="h-6 w-6" />}
                title={favoritesOnly ? "No favorites here yet" : "No books found"}
                description={
                  favoritesOnly
                    ? "Tap the heart on a book, or use its menu, to keep the ones you love close."
                    : "Nothing on this shelf matches those filters. Try a broader search, or clear the filters and begin again."
                }
                action={
                  <button
                    type="button"
                    onClick={
                      favoritesOnly ? () => setFavoritesOnly(false) : clearFilters
                    }
                    className={buttonStyles("secondary", "sm")}
                  >
                    {favoritesOnly ? "Show all books" : "Clear filters"}
                  </button>
                }
              />
            </div>
          ) : status === "all" && !hasFilters ? (
            <div className="mt-11 space-y-14">
              {statusSections.map((section) => {
                const items = sorted.filter(
                  ({ entry }) => entry.status === section.status,
                );
                if (items.length === 0) return null;
                return (
                  <section key={section.status}>
                    <SectionHeading
                      eyebrow={section.eyebrow}
                      title={section.title}
                      description={section.description}
                      action={
                        <span className="text-[0.7rem] tabular-nums text-ink-muted">
                          {items.length} {pluralize(items.length, "book")}
                        </span>
                      }
                    />
                    <div className="mt-6">
                      <BookGrid
                        books={items.map(({ book }) => book)}
                        entries={entries}
                      />
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="mt-9">
              <div className="mb-5 flex items-center justify-between">
                <p className="text-[0.7rem] text-ink-muted">
                  {activeBooks.length} {pluralize(activeBooks.length, "book")}
                  {status !== "all" ? " on this shelf" : ""}
                </p>
                {selectedCollection ? null : (
                  <p className="hidden text-[0.65rem] uppercase tracking-[0.14em] text-ink-muted sm:block">
                    Sorted by{" "}
                    {sort === "last-opened"
                      ? "last opened"
                      : sort === "added"
                        ? "recently added"
                        : sort === "title"
                          ? "title"
                          : "author"}
                  </p>
                )}
              </div>
              <BookGrid books={activeBooks.map(({ book }) => book)} entries={entries} />
            </div>
          )}
        </>
      )}

      <Dialog
        open={newCollectionOpen}
        onOpenChange={(open) => {
          setNewCollectionOpen(open);
          if (!open) setCollectionName("");
        }}
        title="New collection"
        description="A collection can be a mood, a project, a season, or a promise to yourself."
        footer={
          <>
            <button
              type="button"
              onClick={() => setNewCollectionOpen(false)}
              className="h-9 rounded-full px-4 text-[0.8125rem] font-medium text-ink-soft transition-colors hover:bg-muted hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateCollection}
              disabled={!collectionName.trim()}
              className="h-9 rounded-full bg-ink px-4 text-[0.8125rem] font-medium text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Create collection
            </button>
          </>
        }
      >
        <label htmlFor="library-collection-name" className="mb-2 block text-xs text-ink-muted">
          Collection name
        </label>
        <TextInput
          id="library-collection-name"
          value={collectionName}
          onChange={(event) => setCollectionName(event.target.value)}
          placeholder="e.g. Winter evenings"
          maxLength={40}
          autoFocus
          onKeyDown={(event) => {
            if (event.key === "Enter") handleCreateCollection();
          }}
        />
        <p className="mt-3 text-[0.7rem] leading-relaxed text-ink-muted">
          You can add books to a collection from any book's menu.
        </p>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this collection?"
        description="The books will stay in your library. Only the collection itself will be removed."
        footer={
          <>
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="h-9 rounded-full px-4 text-[0.8125rem] font-medium text-ink-soft transition-colors hover:bg-muted hover:text-ink"
            >
              Keep collection
            </button>
            <button
              type="button"
              onClick={handleDeleteCollection}
              className="h-9 rounded-full bg-rose px-4 text-[0.8125rem] font-medium text-white transition-opacity hover:opacity-90"
            >
              Delete
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-muted">
          {collections.find((c) => c.id === deleteTarget)?.name} will be removed from your
          library.
        </p>
      </Dialog>

      <ImportPdfDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
