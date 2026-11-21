# Akshara (अक्षर)

**Every letter opens a new world.**

A local-first digital reading app built around a warm, editorial interface. Your reading
room starts empty — bring in your own PDFs and read them in a comfortable,
distraction-free reader that follows the website theme.

Akshara runs in two modes from the same codebase:

- **Local mode** — no configuration. Everything lives on the device.
- **Account mode** — set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, and reading
  metadata (progress, highlights, notes, bookmarks, collections, sessions, profile)
  syncs across devices for each signed-in user. PDF files always stay on the device
  where they were imported.

## Features

- Home, Library, Favorites, Reading Statistics, and Settings
- Import your own PDFs — no curated catalog, only books you add; cover made from the
  first page, stored offline in this browser
- Personal collections, reading statuses, favorites, and a daily reading goal
- Reading themes (match website, paper, sepia, night), typography controls, focus mode,
  and keyboard shortcuts
- PDF reader with page/width fitting, page navigation, zoom, bookmarks, and tonal themes
  that follow the website theme by default
- Text selection with persistent highlights and notes, anchored to PDF character offsets
- Responsive sidebar and mobile navigation
- Light, dark, and system application themes
- Optional accounts with email + password, row-level-security isolation, and offline-first
  sync that queues changes and replays them when the connection returns

## Getting started

```bash
npm install
npm run dev
```

Then open the URL printed by Vite (usually `http://127.0.0.1:5173/`).

## Accounts and sync (optional)

Sync is off unless a Supabase project is configured, so a plain `npm install && npm run
dev` keeps working with zero backend.

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the schema. Either connect the project to this repository
   (**Project Settings → Integrations → GitHub**, deploy from `main`) or paste
   `supabase/migrations/*.sql` into the SQL Editor in filename order.
3. Copy **Project Settings → API → Project URL** and the **anon public** key into
   `.env.local`:

   ```bash
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```

4. For quick local testing, turn off **Authentication → Providers → Email → Confirm
   email** so a new account can sign in immediately.

The `anon` key is public by design — it ships in the client bundle and row-level
security protects each account's rows. **Never** put the `service_role` key in the app.

### What syncs

| Synced to the account | Stays on the device |
| --- | --- |
| Book metadata (title, author, cover thumbnail) | The PDF file itself |
| Library entries, status, progress | Device appearance theme |
| Reading positions | |
| Highlights, notes, bookmarks | |
| Collections and memberships | |
| Reading sessions | |
| Display name, daily goal, reader preferences | |

### How sync behaves

- The local store is the source of truth for the UI; writes go out about a second later.
- Offline changes queue in `localStorage` and are pushed on reconnect, focus, or every
  30 seconds while online.
- Conflicts are last-write-wins per record, and a record with an unsent local change
  always wins.
- Deletions travel as `deleted_at` tombstones so they do not reappear from another
  device.
- A book that arrived from the account but has no PDF on this device opens to an
  **Attach the PDF** action that stores the file under the existing book id — your
  place, highlights, and bookmarks are kept.

## Build

```bash
npm run build
npm run preview
```

## Desktop application

Akshara also ships as a native desktop app (Electron). It runs the same reader
fully offline in its own window, with a stable app origin for local storage.

```bash
npm run app:start   # build + launch the desktop app
npm run app:dist    # build installers into release/
```

Builds pick up `.env.local`, so the desktop app can sign in to the same account.

On Linux this produces:

- `release/akshara_0.1.0_amd64.deb` — install with `sudo apt install ./release/akshara_0.1.0_amd64.deb`
- `release/Akshara-0.1.0-x86_64.AppImage` — portable build (Ubuntu 24.04+ needs
  `libfuse2t64`; the `.deb` is the safer choice)

Desktop reading data lives in `~/.config/akshara` (its own profile), so the app's
library is separate from any browser tab you used during development.

## Smoke tests

The Playwright smoke suite covers the main routes, the import empty states, importing a
PDF that follows the website theme, favoriting/searching/deleting an imported PDF, the
reader panel focus trap, and the mobile layout. It starts its own Vite server, so the dev
server does not need to be running.

```bash
npm run test:smoke
```

The suite uses an installed Chrome or Chromium binary. It checks `CHROME_PATH` first, then
common Linux locations. Set it explicitly if needed:

```bash
CHROME_PATH=/path/to/chrome npm run test:smoke
```

## Reading data

Local state is persisted under these `localStorage` keys:

- `akshara-library-v1` — library entries, reading positions, collections, bookmarks,
  highlights, imported book metadata, and sessions
- `akshara-settings-v1` — application and reader preferences
- `akshara-sync-v1` — per-account sync bookkeeping (last server timestamps and the
  queue of unsent changes)

Imported PDF files themselves live in IndexedDB (`akshara-files`), because
`localStorage` is too small for books. They never leave the device. Removing an imported
PDF from its book menu deletes both its metadata and its stored file.

Use **Settings → Export copy** to download a JSON backup of library metadata (the PDF
files are not included), or **Reset library** to clear your reading state and start
fresh.

## Database schema

`supabase/migrations/` holds the full schema: `profiles`, `books`, `library_entries`,
`reading_positions`, `highlights`, `bookmarks`, `collections`, `collection_books`, and
`reading_sessions`. Every table carries a `user_id`, row-level security limits each row
to its owner, deletions are tombstones (`deleted_at`), and `updated_at` is maintained by
triggers.
