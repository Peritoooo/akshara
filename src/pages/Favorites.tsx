import { Link } from "react-router-dom";
import { ArrowRight, Heart, Search } from "lucide-react";
import { useBookMap } from "@/hooks/useCatalog";
import { useLibraryStore } from "@/store/library";
import { BookGrid } from "@/components/books/BookCard";
import { EmptyState } from "@/components/ui/Misc";
import { buttonStyles } from "@/components/ui/Button";
import { pluralize } from "@/lib/utils";

export function FavoritesPage() {
  const entries = useLibraryStore((state) => state.entries);
  const bookMap = useBookMap();
  const favorites = Object.values(entries)
    .filter((entry) => entry.favorite)
    .sort(
      (a, b) =>
        new Date(b.lastOpenedAt ?? b.addedAt).getTime() -
        new Date(a.lastOpenedAt ?? a.addedAt).getTime(),
    )
    .map((entry) => bookMap.get(entry.bookId))
    .filter((book) => book !== undefined);

  return (
    <div className="page-wrap pb-16 pt-9 lg:pt-12">
      <header className="relative flex flex-wrap items-end justify-between gap-6 border-b border-line pb-8">
        <div>
          <p className="eyebrow">Kept close</p>
          <h1 className="display-title mt-3 flex items-center gap-4 text-[clamp(2.3rem,4.2vw,3.4rem)] text-ink">
            Favorites
            <Heart className="hidden h-7 w-7 fill-accent/30 text-accent-strong sm:block" strokeWidth={1} />
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-muted">
            {favorites.length > 0
              ? `${favorites.length} ${pluralize(favorites.length, "book")} you have marked to keep near.`
              : "The books you mark with a heart will gather here."}
          </p>
        </div>
        <Link to="/library" className={buttonStyles("secondary", "sm")}>
          <Search className="h-3.5 w-3.5" />
          Search your library
        </Link>
      </header>

      {favorites.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            icon={<Heart className="h-6 w-6" />}
            title="Nothing kept close yet"
            description="When a book matters — or might matter — mark it as a favorite. Those books will live here, away from the rest of the shelf."
            action={
              <Link to="/library" className={buttonStyles("primary", "md")}>
                Go to your library
                <ArrowRight className="h-4 w-4" />
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-10">
            <BookGrid books={favorites} entries={entries} />
          </div>
          <div className="mt-14 flex items-center gap-4 text-[0.625rem] uppercase tracking-[0.18em] text-ink-muted">
            <span className="h-px w-10 bg-line-strong" />
            {favorites.length} {pluralize(favorites.length, "edition")} kept close
          </div>
        </>
      )}
    </div>
  );
}
