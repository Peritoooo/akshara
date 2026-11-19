import { books, getBook } from "@/data/books";
import type {
  Book,
  LibraryEntry,
  ReadingPosition,
  ReadingSession,
} from "@/types";
import { dateKey } from "./utils";

export interface DayReading {
  date: Date;
  key: string;
  minutes: number;
  label: string;
}

export function sessionsByDay(sessions: ReadingSession[]) {
  return sessions.reduce<Record<string, number>>((acc, session) => {
    const key = dateKey(new Date(session.startedAt));
    acc[key] = (acc[key] ?? 0) + session.minutes;
    return acc;
  }, {});
}

export function getStreak(sessions: ReadingSession[]): number {
  const days = sessionsByDay(sessions);
  const cursor = new Date();
  if (!days[dateKey(cursor)]) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days[dateKey(cursor)]) return 0;
  }
  let streak = 0;
  while (days[dateKey(cursor)]) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function getWeekReading(sessions: ReadingSession[]): DayReading[] {
  const days = sessionsByDay(sessions);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return {
      date,
      key: dateKey(date),
      minutes: days[dateKey(date)] ?? 0,
      label: date.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 3),
    };
  });
}

export function getHeatmap(
  sessions: ReadingSession[],
  weeks = 13,
): DayReading[][] {
  const days = sessionsByDay(sessions);
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (weeks * 7 - 1));
  start.setDate(start.getDate() - start.getDay());

  return Array.from({ length: weeks }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) => {
      const date = new Date(start);
      date.setDate(start.getDate() + weekIndex * 7 + dayIndex);
      const inRange = date <= end;
      return {
        date,
        key: dateKey(date),
        minutes: inRange ? (days[dateKey(date)] ?? 0) : -1,
        label: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
      };
    }),
  );
}

export function getStats(
  sessions: ReadingSession[],
  entries: Record<string, LibraryEntry>,
) {
  const totalMinutes = sessions.reduce((sum, s) => sum + s.minutes, 0);
  const finished = Object.values(entries).filter(
    (entry) => entry.status === "finished",
  ).length;
  const week = getWeekReading(sessions);
  const weekMinutes = week.reduce((sum, day) => sum + day.minutes, 0);
  const activeDays = new Set(sessions.map((s) => dateKey(new Date(s.startedAt))))
    .size;
  const avgSession = sessions.length ? totalMinutes / sessions.length : 0;
  const streak = getStreak(sessions);

  return {
    totalMinutes,
    finished,
    weekMinutes,
    activeDays,
    avgSession,
    streak,
    week,
    heatmap: getHeatmap(sessions),
  };
}

export function getGenreBreakdown(
  sessions: ReadingSession[],
  catalog: Book[] = books,
) {
  const minutesByBook = sessions.reduce<Record<string, number>>((acc, s) => {
    acc[s.bookId] = (acc[s.bookId] ?? 0) + s.minutes;
    return acc;
  }, {});

  const byGenre: Record<string, number> = {};
  for (const book of catalog) {
    const minutes = minutesByBook[book.id];
    if (!minutes) continue;
    const genre = book.genres[0] ?? "Other";
    byGenre[genre] = (byGenre[genre] ?? 0) + minutes;
  }

  return Object.entries(byGenre)
    .map(([genre, minutes]) => ({ genre, minutes }))
    .sort((a, b) => b.minutes - a.minutes);
}

export function getMostReadBook(
  sessions: ReadingSession[],
  catalog: Book[] = books,
) {
  const minutesByBook = sessions.reduce<Record<string, number>>((acc, s) => {
    acc[s.bookId] = (acc[s.bookId] ?? 0) + s.minutes;
    return acc;
  }, {});
  const top = Object.entries(minutesByBook).sort((a, b) => b[1] - a[1])[0];
  if (!top) return null;
  return {
    book:
      catalog.find((book) => book.id === top[0]) ?? getBook(top[0]),
    minutes: top[1],
  };
}

export function readingProgress(
  entry: LibraryEntry | undefined,
  position: ReadingPosition | undefined,
): number {
  return position?.percent ?? entry?.progress ?? 0;
}

export function getCollectionCount(
  entries: Record<string, LibraryEntry>,
  collectionId: string,
) {
  return Object.values(entries).filter((entry) =>
    entry.collections.includes(collectionId),
  ).length;
}
