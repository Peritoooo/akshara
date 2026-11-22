import { supabase } from "./supabase";
import { useSyncStatus } from "./syncStatus";
import { useLibraryStore } from "@/store/library";
import { useSettingsStore } from "@/store/settings";
import type {
  Book,
  Bookmark,
  Collection,
  Highlight,
  HighlightColor,
  LibraryEntry,
  ReadingPosition,
  ReadingSession,
  ReadingStatus,
} from "@/types";

/**
 * Metadata-only sync.
 *
 * The local zustand stores stay the source of truth for the UI and keep
 * working offline. This module watches them, records what changed, and moves
 * those records to Postgres. PDFs never leave the device.
 *
 * Conflict rule: a record with a queued local change wins; otherwise the
 * server copy wins when it changed since we last saw it. No wall-clock
 * comparison is involved, so device clock skew cannot lose an edit.
 */

type Table =
  | "books"
  | "library_entries"
  | "reading_positions"
  | "highlights"
  | "bookmarks"
  | "collections"
  | "collection_books"
  | "reading_sessions";

type Row = Record<string, unknown>;
type Op = "upsert" | "delete";

const TABLES: Table[] = [
  "books",
  "library_entries",
  "reading_positions",
  "highlights",
  "bookmarks",
  "collections",
  "collection_books",
  "reading_sessions",
];

const ID_COLUMNS: Record<Table, string[]> = {
  books: ["id"],
  library_entries: ["book_id"],
  reading_positions: ["book_id"],
  highlights: ["id"],
  bookmarks: ["id"],
  collections: ["id"],
  collection_books: ["collection_id", "book_id"],
  reading_sessions: ["id"],
};

const ON_CONFLICT: Record<Table, string> = {
  books: "user_id,id",
  library_entries: "user_id,book_id",
  reading_positions: "user_id,book_id",
  highlights: "id",
  bookmarks: "id",
  collections: "user_id,id",
  collection_books: "user_id,collection_id,book_id",
  reading_sessions: "id",
};

const PENDING_BATCH = 200;
const PUSH_DELAY = 1200;
const PULL_INTERVAL = 30_000;

const STORAGE_KEY = "akshara-sync-v1";
const PROFILE_STORAGE_KEY = "akshara-sync-profile-v1";

interface SyncMeta {
  userId: string;
  /** last server `updated_at` we have seen (or written) per record */
  base: Record<string, string>;
  pending: Record<string, Op>;
}

interface Engine {
  userId: string;
  meta: SyncMeta;
  lastRows: Record<string, Row>;
  applying: boolean;
  busy: boolean;
  stopped: boolean;
  pushTimer: number | null;
  profileTimer: number | null;
  interval: number | null;
  cleanups: Array<() => void>;
  profileBase?: string;
}

let engine: Engine | null = null;

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const rowKey = (table: Table, ...ids: string[]) =>
  `${table}:${ids.map((id) => String(id)).join("|")}`;

const str = (row: Row, column: string, fallback = "") =>
  typeof row[column] === "string" ? (row[column] as string) : fallback;

const maybeStr = (row: Row, column: string) => {
  const value = row[column];
  return typeof value === "string" && value.length > 0 ? value : undefined;
};

const num = (row: Row, column: string, fallback = 0) => {
  const value = row[column];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
};

const optionalNum = (row: Row, column: string) => {
  const value = row[column];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
};

function identity(row: Row, table: Table): string[] {
  return ID_COLUMNS[table].map((column) => String(row[column] ?? ""));
}

function readMeta(userId: string): SyncMeta {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SyncMeta;
      if (parsed.userId === userId) {
        return {
          userId,
          base: parsed.base ?? {},
          pending: parsed.pending ?? {},
        };
      }
    }
  } catch {
    // Corrupt state is no worse than no state: rebuild from the server.
  }
  return { userId, base: {}, pending: {} };
}

function persistMeta(active: Engine) {
  // Sign-out (or another account) may have taken over while a pull or push was
  // in flight. Never resurrect bookkeeping that was deliberately cleared.
  if (active.stopped || engine !== active) return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        userId: active.meta.userId,
        base: active.meta.base,
        pending: active.meta.pending,
      }),
    );
  } catch {
    // Private-mode or full storage: sync still works for this session.
  }
}

export function clearSyncState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PROFILE_STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}

type StatusPatch = {
  phase?: "idle" | "syncing" | "offline" | "error";
  pending?: number;
  lastSyncedAt?: string;
  error?: string;
};

function publishStatus(patch: StatusPatch) {
  useSyncStatus.getState().set(patch);
}

// ---------------------------------------------------------------------------
// local snapshot -> rows
// ---------------------------------------------------------------------------

export function rowsFromLocal(): Record<string, Row> {
  const state = useLibraryStore.getState();
  const rows: Record<string, Row> = {};

  state.customBooks.forEach((book) => {
    rows[rowKey("books", book.id)] = {
      id: book.id,
      title: book.title,
      author: book.author,
      description: book.description,
      genres: book.genres,
      year: Number.isFinite(book.year) ? book.year : null,
      pages: book.pages,
      language: book.language,
      format: book.format,
      file: book.file,
      publisher: book.publisher,
      cover: book.cover,
      motif: book.motif ?? null,
      cover_image: book.coverImage ?? null,
      added_at: book.addedAt,
      deleted_at: null,
    };
  });

  Object.values(state.entries).forEach((entry) => {
    rows[rowKey("library_entries", entry.bookId)] = {
      book_id: entry.bookId,
      status: entry.status,
      progress: entry.progress,
      favorite: entry.favorite,
      added_at: entry.addedAt,
      last_opened_at: entry.lastOpenedAt ?? null,
      finished_at: entry.finishedAt ?? null,
      deleted_at: null,
    };
    entry.collections.forEach((collectionId) => {
      rows[rowKey("collection_books", collectionId, entry.bookId)] = {
        collection_id: collectionId,
        book_id: entry.bookId,
        deleted_at: null,
      };
    });
  });

  Object.values(state.positions).forEach((position) => {
    rows[rowKey("reading_positions", position.bookId)] = {
      book_id: position.bookId,
      percent: position.percent,
      location: position.location ?? null,
      page: position.page ?? null,
      deleted_at: null,
    };
  });

  state.highlights.forEach((highlight) => {
    rows[rowKey("highlights", highlight.id)] = {
      id: highlight.id,
      book_id: highlight.bookId,
      cfi_range: highlight.cfiRange,
      text: highlight.text,
      note: highlight.note ?? null,
      color: highlight.color,
      chapter: highlight.chapter ?? null,
      created_at: highlight.createdAt,
      deleted_at: null,
    };
  });

  state.bookmarks.forEach((bookmark) => {
    rows[rowKey("bookmarks", bookmark.id)] = {
      id: bookmark.id,
      book_id: bookmark.bookId,
      location: bookmark.location ?? null,
      page: bookmark.page ?? null,
      label: bookmark.label,
      percent: bookmark.percent,
      created_at: bookmark.createdAt,
      deleted_at: null,
    };
  });

  state.collections.forEach((collection) => {
    rows[rowKey("collections", collection.id)] = {
      id: collection.id,
      name: collection.name,
      description: collection.description ?? null,
      created_at: collection.createdAt,
      deleted_at: null,
    };
  });

  state.sessions.forEach((session) => {
    rows[rowKey("reading_sessions", session.id)] = {
      id: session.id,
      book_id: session.bookId,
      started_at: session.startedAt,
      minutes: session.minutes,
      deleted_at: null,
    };
  });

  return rows;
}

// ---------------------------------------------------------------------------
// rows -> local
// ---------------------------------------------------------------------------

function toBook(row: Row): Book {
  const cover = row.cover as Book["cover"] | null;
  return {
    id: str(row, "id"),
    title: str(row, "title", "Untitled"),
    author: str(row, "author"),
    description: str(row, "description"),
    genres: Array.isArray(row.genres) ? (row.genres as string[]) : [],
    year: num(row, "year", 0),
    pages: num(row, "pages", 0),
    language: str(row, "language"),
    format: row.format === "epub" ? "epub" : "pdf",
    file: str(row, "file"),
    publisher: str(row, "publisher"),
    cover:
      cover ??
      { bg: "#3A3530", ink: "#F2EBDD", accent: "#C6A978" },
    motif: (maybeStr(row, "motif") as Book["motif"]) ?? "arch",
    addedAt: str(row, "added_at", new Date().toISOString()),
    custom: true,
    coverImage: maybeStr(row, "cover_image"),
  };
}

function toEntry(row: Row): LibraryEntry {
  const status = str(row, "status", "want") as ReadingStatus;
  return {
    bookId: str(row, "book_id"),
    status: status === "reading" || status === "finished" ? status : "want",
    addedAt: str(row, "added_at", new Date().toISOString()),
    lastOpenedAt: maybeStr(row, "last_opened_at"),
    finishedAt: maybeStr(row, "finished_at"),
    progress: num(row, "progress", 0),
    favorite: Boolean(row.favorite),
    collections: [],
  };
}

function toPosition(row: Row): ReadingPosition {
  return {
    bookId: str(row, "book_id"),
    percent: num(row, "percent", 0),
    location: maybeStr(row, "location"),
    page: optionalNum(row, "page"),
    updatedAt: str(row, "updated_at", new Date().toISOString()),
  };
}

function toHighlight(row: Row): Highlight {
  return {
    id: str(row, "id"),
    bookId: str(row, "book_id"),
    cfiRange: str(row, "cfi_range"),
    text: str(row, "text"),
    note: maybeStr(row, "note"),
    color: str(row, "color", "gold") as HighlightColor,
    chapter: maybeStr(row, "chapter"),
    createdAt: str(row, "created_at", new Date().toISOString()),
  };
}

function toBookmark(row: Row): Bookmark {
  return {
    id: str(row, "id"),
    bookId: str(row, "book_id"),
    location: maybeStr(row, "location"),
    page: optionalNum(row, "page"),
    label: str(row, "label"),
    percent: num(row, "percent", 0),
    createdAt: str(row, "created_at", new Date().toISOString()),
  };
}

function toCollection(row: Row): Collection {
  return {
    id: str(row, "id"),
    name: str(row, "name", "Collection"),
    description: maybeStr(row, "description"),
    createdAt: str(row, "created_at", new Date().toISOString()),
  };
}

function toSession(row: Row): ReadingSession {
  return {
    id: str(row, "id"),
    bookId: str(row, "book_id"),
    startedAt: str(row, "started_at", new Date().toISOString()),
    minutes: num(row, "minutes", 0),
  };
}

// ---------------------------------------------------------------------------
// pull + merge
// ---------------------------------------------------------------------------

function mergeRemote(
  active: Engine,
  remote: Record<Table, Row[]>,
): boolean {
  const state = useLibraryStore.getState();
  const books = new Map(state.customBooks.map((book) => [book.id, book]));
  const entries = { ...state.entries };
  const positions = { ...state.positions };
  const collections = new Map(state.collections.map((item) => [item.id, item]));
  const highlights = new Map(state.highlights.map((item) => [item.id, item]));
  const bookmarks = new Map(state.bookmarks.map((item) => [item.id, item]));
  const sessions = new Map(state.sessions.map((item) => [item.id, item]));

  const seenMemberships = new Map<string, Set<string>>();
  const liveMemberships = new Map<string, Set<string>>();
  let changed = false;

  const noteMembership = (
    target: Map<string, Set<string>>,
    bookId: string,
    collectionId: string,
  ) => {
    const set = target.get(bookId) ?? new Set<string>();
    set.add(collectionId);
    target.set(bookId, set);
  };

  TABLES.forEach((table) => {
    (remote[table] ?? []).forEach((row) => {
      const key = rowKey(table, ...identity(row, table));
      if (active.meta.pending[key]) return;

      const remoteTs = str(row, "updated_at");
      if (!remoteTs || active.meta.base[key] === remoteTs) return;

      const deleted = Boolean(row.deleted_at);

      switch (table) {
        case "books": {
          const id = str(row, "id");
          if (deleted) {
            if (books.delete(id)) changed = true;
          } else {
            books.set(id, toBook(row));
            changed = true;
          }
          break;
        }
        case "library_entries": {
          const bookId = str(row, "book_id");
          if (deleted) {
            if (entries[bookId]) {
              delete entries[bookId];
              changed = true;
            }
          } else {
            const existing = entries[bookId];
            entries[bookId] = {
              ...toEntry(row),
              collections: existing?.collections ?? [],
            };
            changed = true;
          }
          break;
        }
        case "reading_positions": {
          const bookId = str(row, "book_id");
          if (deleted) {
            if (positions[bookId]) {
              delete positions[bookId];
              changed = true;
            }
          } else {
            positions[bookId] = toPosition(row);
            changed = true;
          }
          break;
        }
        case "highlights": {
          const id = str(row, "id");
          if (deleted) {
            if (highlights.delete(id)) changed = true;
          } else {
            highlights.set(id, toHighlight(row));
            changed = true;
          }
          break;
        }
        case "bookmarks": {
          const id = str(row, "id");
          if (deleted) {
            if (bookmarks.delete(id)) changed = true;
          } else {
            bookmarks.set(id, toBookmark(row));
            changed = true;
          }
          break;
        }
        case "collections": {
          const id = str(row, "id");
          if (deleted) {
            if (collections.delete(id)) changed = true;
          } else {
            collections.set(id, toCollection(row));
            changed = true;
          }
          break;
        }
        case "reading_sessions": {
          const id = str(row, "id");
          if (deleted) {
            if (sessions.delete(id)) changed = true;
          } else {
            sessions.set(id, toSession(row));
            changed = true;
          }
          break;
        }
        case "collection_books": {
          const collectionId = str(row, "collection_id");
          const bookId = str(row, "book_id");
          noteMembership(seenMemberships, bookId, collectionId);
          if (!deleted) noteMembership(liveMemberships, bookId, collectionId);
          break;
        }
      }

      active.meta.base[key] = remoteTs;
      changed = true;
    });
  });

  // Rebuild collection membership from the server, keeping local-only
  // memberships that have never been uploaded and local changes in flight.
  seenMemberships.forEach((seen, bookId) => {
    const entry = entries[bookId];
    if (!entry) return;
    if (active.meta.pending[rowKey("library_entries", bookId)]) return;

    const live = liveMemberships.get(bookId) ?? new Set<string>();
    const pendingOp = (collectionId: string) =>
      active.meta.pending[rowKey("collection_books", collectionId, bookId)];

    const next = new Set<string>();
    entry.collections.forEach((collectionId) => {
      const op = pendingOp(collectionId);
      if (op === "delete") return;
      if (op === "upsert" || live.has(collectionId) || !seen.has(collectionId)) {
        next.add(collectionId);
      }
    });
    live.forEach((collectionId) => {
      if (pendingOp(collectionId) !== "delete") next.add(collectionId);
    });

    const ordered = [
      ...entry.collections.filter((id) => next.has(id)),
      ...[...next].filter((id) => !entry.collections.includes(id)),
    ];
    if (
      ordered.length !== entry.collections.length ||
      ordered.some((id, index) => id !== entry.collections[index])
    ) {
      entries[bookId] = { ...entry, collections: ordered };
      changed = true;
    }
  });

  if (!changed) return false;

  active.applying = true;
  useLibraryStore.setState({
    customBooks: [...books.values()],
    entries,
    positions,
    collections: [...collections.values()],
    bookmarks: [...bookmarks.values()],
    highlights: [...highlights.values()],
    sessions: [...sessions.values()].slice(-1500),
  });
  active.applying = false;
  active.lastRows = rowsFromLocal();
  return true;
}

// ---------------------------------------------------------------------------
// profile
// ---------------------------------------------------------------------------

function applyProfile(row: Row) {
  const preferences = (row.preferences ?? {}) as Record<string, unknown>;
  const defaults = useSettingsStore.getState().reader;
  const reader = { ...defaults, ...preferences } as typeof defaults;
  useSettingsStore.setState({
    displayName: str(row, "display_name", "Reader"),
    dailyGoal: num(row, "daily_goal", 30),
    reader,
  });
}

async function pullProfile(active: Engine) {
  if (!supabase || active.stopped) return;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", active.userId)
    .maybeSingle();
  if (error || !data) return;
  if (active.stopped || engine !== active) return;

  const row = data as Row;
  const remoteTs = str(row, "updated_at");
  if (!remoteTs || remoteTs === active.profileBase) return;

  const preferences = (row.preferences ?? {}) as Record<string, unknown>;
  const hasPreferences = Object.keys(preferences).length > 0;

  if (!hasPreferences) {
    // A fresh account (or one that never changed reading preferences):
    // keep this device's reader defaults and adopt the sign-up name/goal.
    const current = useSettingsStore.getState();
    const serverName = str(row, "display_name", "Reader");
    const serverGoal = num(row, "daily_goal", 30);
    active.applying = true;
    useSettingsStore.setState({
      displayName:
        serverName === "Reader" && current.displayName
          ? current.displayName
          : serverName,
      dailyGoal:
        serverGoal === 30 && current.dailyGoal !== 30
          ? current.dailyGoal
          : serverGoal,
      reader: current.reader,
    });
    active.applying = false;
    active.profileBase = remoteTs;
    await pushProfile(active);
    return;
  }

  active.applying = true;
  applyProfile(row);
  active.applying = false;
  active.profileBase = remoteTs;
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, remoteTs);
  } catch {
    // Non-fatal.
  }
}

async function pushProfile(active: Engine) {
  if (!supabase || active.stopped) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  const settings = useSettingsStore.getState();
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: active.userId,
        display_name: settings.displayName,
        daily_goal: settings.dailyGoal,
        preferences: settings.reader,
      },
      { onConflict: "id" },
    )
    .select("updated_at")
    .maybeSingle();
  if (error || !data) return;
  if (active.stopped || engine !== active) return;
  active.profileBase = str(data as Row, "updated_at");
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, active.profileBase);
  } catch {
    // Non-fatal.
  }
}

// ---------------------------------------------------------------------------
// push
// ---------------------------------------------------------------------------

function setPending(active: Engine, key: string, op: Op) {
  active.meta.pending[key] = op;
}

/** Records this device has that the server has never seen (first sign-in). */
function seedUnpushed(active: Engine) {
  const rows = rowsFromLocal();
  let touched = false;
  Object.keys(rows).forEach((key) => {
    if (!active.meta.base[key] && !active.meta.pending[key]) {
      active.meta.pending[key] = "upsert";
      touched = true;
    }
  });
  if (touched) {
    persistMeta(active);
    publishStatus({ pending: Object.keys(active.meta.pending).length });
  }
}

function detectLocalChanges(active: Engine) {
  if (active.applying) return;
  const rows = rowsFromLocal();
  let touched = false;

  Object.keys(rows).forEach((key) => {
    const previous = active.lastRows[key];
    if (!previous || JSON.stringify(previous) !== JSON.stringify(rows[key])) {
      setPending(active, key, "upsert");
      touched = true;
    }
  });

  Object.keys(active.lastRows).forEach((key) => {
    if (!rows[key]) {
      setPending(active, key, "delete");
      touched = true;
    }
  });

  active.lastRows = rows;
  if (touched) {
    persistMeta(active);
    publishStatus({ pending: Object.keys(active.meta.pending).length });
    schedulePush(active);
  }
}

function schedulePush(active: Engine) {
  if (active.stopped) return;
  if (active.pushTimer !== null) window.clearTimeout(active.pushTimer);
  active.pushTimer = window.setTimeout(() => {
    active.pushTimer = null;
    void flush(active);
  }, PUSH_DELAY);
}

function scheduleProfilePush(active: Engine) {
  if (active.profileTimer !== null) window.clearTimeout(active.profileTimer);
  active.profileTimer = window.setTimeout(() => {
    active.profileTimer = null;
    void pushProfile(active);
  }, PUSH_DELAY + 300);
}

async function flush(active: Engine): Promise<boolean> {
  if (!supabase || active.stopped) return false;

  const keys = Object.keys(active.meta.pending);
  if (keys.length === 0) {
    publishStatus({ phase: "idle", pending: 0 });
    return true;
  }

  if (active.busy) {
    // A pull or push is still in flight; try again once it finishes.
    schedulePush(active);
    return false;
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    publishStatus({
      phase: "offline",
      pending: keys.length,
    });
    return false;
  }

  const client = supabase;
  active.busy = true;
  publishStatus({ phase: "syncing", pending: keys.length, error: undefined });

  const rows = rowsFromLocal();
  const grouped = new Map<Table, { upsert: string[]; delete: string[] }>();
  TABLES.forEach((table) =>
    grouped.set(table, { upsert: [], delete: [] }),
  );

  keys.forEach((key) => {
    const table = key.slice(0, key.indexOf(":")) as Table;
    if (!TABLES.includes(table)) return;
    const group = grouped.get(table);
    if (!group) return;
    const op = active.meta.pending[key];
    if (op === "upsert" && rows[key]) group.upsert.push(key);
    else if (op === "delete") group.delete.push(key);
    else if (op === "upsert") group.delete.push(key);
  });

  try {
    for (const table of TABLES) {
      const group = grouped.get(table);
      if (!group) continue;

      // --- upserts -------------------------------------------------------
      for (let start = 0; start < group.upsert.length; start += PENDING_BATCH) {
        const batchKeys = group.upsert.slice(start, start + PENDING_BATCH);
        const payload = batchKeys.map((key) => ({
          ...(rows[key] ?? {}),
          user_id: active.userId,
        }));

        const { data, error } = await client
          .from(table)
          .upsert(payload, { onConflict: ON_CONFLICT[table] })
          .select();
        if (error) throw new Error(`${table}: ${error.message}`);

        (data ?? []).forEach((raw) => {
          const row = raw as Row;
          const key = rowKey(table, ...identity(row, table));
          const ts = str(row, "updated_at");
          if (ts) active.meta.base[key] = ts;
          delete active.meta.pending[key];
        });
      }

      // --- tombstones ----------------------------------------------------
      const idColumns = ID_COLUMNS[table];
      if (idColumns.length === 1) {
        const column = idColumns[0];
        const ids = group.delete.map(
          (key) => key.slice(key.indexOf(":") + 1),
        );
        for (let start = 0; start < ids.length; start += PENDING_BATCH) {
          const chunk = ids.slice(start, start + PENDING_BATCH);
          const { data, error } = await client
            .from(table)
            .update({ deleted_at: new Date().toISOString() })
            .eq("user_id", active.userId)
            .in(column, chunk)
            .select();
          if (error) throw new Error(`${table}: ${error.message}`);

          const returned = new Map<string, string>();
          (data ?? []).forEach((raw) => {
            const row = raw as Row;
            returned.set(str(row, column), str(row, "updated_at"));
          });
          chunk.forEach((id) => {
            const key = rowKey(table, id);
            const ts = returned.get(id);
            if (ts) active.meta.base[key] = ts;
            else delete active.meta.base[key];
            delete active.meta.pending[key];
          });
        }
      } else {
        for (const key of group.delete) {
          const [, rawId] = key.split(/:(.*)/s);
          const ids = rawId.split("|");
          const filters = Object.fromEntries(
            idColumns.map((column, index) => [column, ids[index]]),
          );
          let query = client
            .from(table)
            .update({ deleted_at: new Date().toISOString() })
            .eq("user_id", active.userId);
          Object.entries(filters).forEach(([column, value]) => {
            query = query.eq(column, value);
          });
          const { data, error } = await query.select();
          if (error) throw new Error(`${table}: ${error.message}`);
          const ts = data && data[0] ? str(data[0] as Row, "updated_at") : "";
          if (ts) active.meta.base[key] = ts;
          else delete active.meta.base[key];
          delete active.meta.pending[key];
        }
      }
    }

    persistMeta(active);
    publishStatus({
      phase: "idle",
      pending: Object.keys(active.meta.pending).length,
      lastSyncedAt: new Date().toISOString(),
      error: undefined,
    });
    return Object.keys(active.meta.pending).length === 0;
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : "Could not reach the server.";
    persistMeta(active);
    publishStatus({
      phase: navigator.onLine === false ? "offline" : "error",
      pending: Object.keys(active.meta.pending).length,
      error: message,
    });
    return false;
  } finally {
    active.busy = false;
  }
}

// ---------------------------------------------------------------------------
// pull
// ---------------------------------------------------------------------------

async function pull(active: Engine): Promise<boolean> {
  if (!supabase || active.stopped || active.busy) return false;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    publishStatus({ phase: "offline" });
    return false;
  }

  const client = supabase;
  active.busy = true;
  publishStatus({ phase: "syncing" });

  try {
    // Books carry cover thumbnails, so only download the ones that changed.
    const tokenResponse = await client
      .from("books")
      .select("id,updated_at,deleted_at")
      .eq("user_id", active.userId);
    if (tokenResponse.error) throw new Error(tokenResponse.error.message);

    const changedBookIds = (tokenResponse.data ?? [])
      .map((raw) => raw as Row)
      .filter((row) => {
        const key = rowKey("books", str(row, "id"));
        const ts = str(row, "updated_at");
        return ts && !active.meta.pending[key] && active.meta.base[key] !== ts;
      })
      .map((row) => str(row, "id"));

    const [bookResponse, ...others] = await Promise.all([
      changedBookIds.length > 0
        ? client
            .from("books")
            .select("*")
            .eq("user_id", active.userId)
            .in("id", changedBookIds)
        : Promise.resolve({ data: [] as Row[], error: null }),
      ...TABLES.filter((table) => table !== "books").map((table) =>
        client.from(table).select("*").eq("user_id", active.userId),
      ),
    ]);

    if (bookResponse.error) throw new Error(bookResponse.error.message);

    const remote = {} as Record<Table, Row[]>;
    remote.books = (bookResponse.data ?? []) as Row[];
    TABLES.filter((table) => table !== "books").forEach((table, index) => {
      const response = others[index];
      if (response.error) throw new Error(response.error.message);
      remote[table] = (response.data ?? []) as Row[];
    });

    if (active.stopped) return false;
    mergeRemote(active, remote);
    await pullProfile(active);
    persistMeta(active);

    publishStatus({
      phase: "idle",
      pending: Object.keys(active.meta.pending).length,
      lastSyncedAt: new Date().toISOString(),
      error: undefined,
    });
    return true;
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : "Could not reach the server.";
    publishStatus({
      phase: navigator.onLine === false ? "offline" : "error",
      error: message,
    });
    return false;
  } finally {
    active.busy = false;
    if (
      !active.stopped &&
      Object.keys(active.meta.pending).length > 0 &&
      active.pushTimer === null
    ) {
      schedulePush(active);
    }
  }
}

// ---------------------------------------------------------------------------
// lifecycle
// ---------------------------------------------------------------------------

export async function startSync(userId: string): Promise<() => void> {
  stopSync();
  if (!supabase) return () => undefined;

  const active: Engine = {
    userId,
    meta: readMeta(userId),
    lastRows: rowsFromLocal(),
    applying: false,
    busy: false,
    stopped: false,
    pushTimer: null,
    profileTimer: null,
    interval: null,
    cleanups: [],
    profileBase: (() => {
      try {
        return localStorage.getItem(PROFILE_STORAGE_KEY) ?? undefined;
      } catch {
        return undefined;
      }
    })(),
  };
  engine = active;

  active.cleanups.push(
    useLibraryStore.subscribe(() => detectLocalChanges(active)),
  );
  active.cleanups.push(
    useSettingsStore.subscribe(() => {
      if (active.applying) return;
      scheduleProfilePush(active);
    }),
  );

  const onOnline = () => {
    publishStatus({ phase: "syncing" });
    void pull(active).then(() => flush(active));
  };
  const onFocus = () => {
    void pull(active);
  };
  const onVisible = () => {
    if (document.visibilityState === "visible") void pull(active);
  };

  window.addEventListener("online", onOnline);
  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onVisible);
  active.cleanups.push(() => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("focus", onFocus);
    document.removeEventListener("visibilitychange", onVisible);
  });

  active.interval = window.setInterval(() => {
    void pull(active).then(() => flush(active));
  }, PULL_INTERVAL);
  active.cleanups.push(() => {
    if (active.interval !== null) window.clearInterval(active.interval);
  });

  publishStatus({
    phase: "idle",
    pending: Object.keys(active.meta.pending).length,
    error: undefined,
  });

  await pull(active);
  if (active.stopped) return () => undefined;
  seedUnpushed(active);
  await flush(active);
  if (active.stopped) return () => undefined;

  return () => {
    active.stopped = true;
    if (active.pushTimer !== null) window.clearTimeout(active.pushTimer);
    if (active.profileTimer !== null) window.clearTimeout(active.profileTimer);
    active.cleanups.forEach((cleanup) => cleanup());
    active.cleanups = [];
    if (engine === active) engine = null;
  };
}

export function stopSync() {
  if (!engine) return;
  const active = engine;
  active.stopped = true;
  if (active.pushTimer !== null) window.clearTimeout(active.pushTimer);
  if (active.profileTimer !== null) window.clearTimeout(active.profileTimer);
  active.cleanups.forEach((cleanup) => cleanup());
  active.cleanups = [];
  engine = null;
}

/** Push anything queued. Returns how many changes are still waiting. */
export async function flushPending(): Promise<number> {
  if (!engine) return 0;
  await flush(engine);
  return Object.keys(engine.meta.pending).length;
}

/** Pull, then push. Used by the "Sync now" action. */
export async function syncNow(): Promise<{ ok: boolean; message?: string }> {
  if (!engine) return { ok: false, message: "Sync is not running." };
  const pulled = await pull(engine);
  const pushed = await flush(engine);
  if (!pulled || !pushed) {
    return {
      ok: false,
      message: useSyncStatus.getState().error ?? "Could not reach the server.",
    };
  }
  return { ok: true };
}
