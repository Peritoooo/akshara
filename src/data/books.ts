import type { Book } from "@/types";

// The curated catalog has been retired. Your reading room now holds only the
// books you bring to it — PDFs imported from your own device.

export const books: Book[] = [];

export const bookById = new Map<string, Book>(
  books.map((book) => [book.id, book]),
);

export function getBook(id: string | undefined): Book | undefined {
  return id ? bookById.get(id) : undefined;
}

export const featuredBook: Book | undefined = books[0];

export const estimatedMinutes = (book: Book) => Math.round(book.pages * 1.7);
