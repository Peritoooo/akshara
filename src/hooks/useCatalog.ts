import { useMemo } from "react";
import { books as catalogBooks } from "@/data/books";
import { useLibraryStore } from "@/store/library";
import type { Book } from "@/types";

/**
 * The full shelf: the curated catalog plus any PDFs the reader imported.
 * Imported books come first so they are easy to find.
 */
export function useAllBooks(): Book[] {
  const customBooks = useLibraryStore((state) => state.customBooks);
  return useMemo(() => [...customBooks, ...catalogBooks], [customBooks]);
}

export function useBookMap(): Map<string, Book> {
  const allBooks = useAllBooks();
  return useMemo(
    () => new Map(allBooks.map((book) => [book.id, book])),
    [allBooks],
  );
}

export function useBook(id: string | undefined): Book | undefined {
  const allBooks = useAllBooks();
  return useMemo(
    () => (id ? allBooks.find((book) => book.id === id) : undefined),
    [allBooks, id],
  );
}
