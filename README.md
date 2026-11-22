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
- Password reset by email, in-app password change, and permanent account deletion

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

### Redirect URLs

Supabase only sends links to addresses on its allowlist. Add these under
**Authentication → URL Configuration**:

- **Site URL:** your web origin (for example `https://akshara.vercel.app`)
- **Redirect URLs:**
  - `https://akshara.vercel.app` (web password reset)
  - `akshara://auth/recovery` (desktop password reset)
  - `http://localhost:5173` (development)

### Email delivery

Password reset and sign-up emails use Supabase's built-in mailer, which is heavily
rate-limited (a few messages per hour). Before inviting real readers, connect a
transactional provider under **Authentication → Emails → SMTP Settings** and verify the
sender domain. Until then, add accounts manually from **Authentication → Users** with
**Auto Confirm User** enabled.

### Password reset

- **Web:** “Forgot password?” emails a link back to the app; the user chooses a new
  password there.
- **Desktop:** the same link opens through the `akshara://` handler. The app registers the
  scheme at install time, exchanges the link's tokens, and shows the “Choose a new
  password” screen. A fresh install needs one sign-out/sign-in if the OS has not yet
  picked up the handler.

### Deleting an account

**Settings → Delete account** calls the `delete_account()` database function, which
removes the caller's rows and their login in one transaction, then wipes this device's
library, sync state, and stored PDFs. It cannot be undone.

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

## Web hosting (Vercel)

The same build runs as a website. `vercel.json` rewrites every route to `index.html`
so a refresh on `/library` or `/read/:id` still works.

1. Import the repository at [vercel.com/new](https://vercel.com/new); the Vite preset is
   detected automatically.
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to **Project → Settings →
   Environment Variables** for Production and Preview, then redeploy.
3. Add the deployment origin to Supabase's **Site URL / Redirect URLs** (above).

From the CLI:

```bash
npx vercel link
npx vercel env add VITE_SUPABASE_URL production
npx vercel env add VITE_SUPABASE_ANON_KEY production
npx vercel --prod
```

### GitHub sign-in

GitHub OAuth is intentionally off until a web origin exists, because the Electron build
has to hand the flow to the system browser and receive the callback over `akshara://`.
When the web app is live:

1. Create an OAuth App at **GitHub → Settings → Developer settings → OAuth Apps**.
   - Homepage URL: `https://your-app.vercel.app`
   - Authorization callback URL: `https://<project-ref>.supabase.co/auth/v1/callback`
2. In Supabase, open **Authentication → Providers → GitHub**, enable it, and paste the
   client ID and secret.
3. Add `https://your-app.vercel.app` and `akshara://auth/callback` to the redirect
   allowlist.
4. Call `supabase.auth.signInWithOAuth({ provider: "github", options: { redirectTo } })`
   — with `skipBrowserRedirect: true` in Electron, then open the returned URL with the
   system browser. The `AuthLinkBridge` already accepts `akshara://auth/callback#…`.

## Desktop application

Akshara also ships as a native desktop app (Electron). It runs the same reader
fully offline in its own window, with a stable app origin for local storage.

```bash
npm run app:start   # build + launch the desktop app
npm run app:dist    # build installers into release/
```

Builds pick up `.env.local`, so the desktop app can sign in to the same account.

On Linux this produces:

- `release/akshara_0.2.0_amd64.deb` — install with `sudo apt install ./release/akshara_0.2.0_amd64.deb`
- `release/Akshara-0.2.0-x86_64.AppImage` — portable build (Ubuntu 24.04+ needs
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
