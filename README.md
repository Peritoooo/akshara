# Akshara (अक्षर)

**Every letter opens a new world.**

A local-first **desktop** PDF reader with a warm, editorial interface. Your reading room
starts empty — bring in your own PDFs and read them in a comfortable, distraction-free
window that follows the app theme.

Akshara is distributed only as a desktop application. There is no web deployment, no
browser build to host, and no server that stores books. Optional accounts keep reading
metadata (progress, highlights, notes, bookmarks, collections, sessions, profile) in sync
between the computers you use. **PDF files never leave the device that imported them.**

Akshara runs in two modes from the same build:

- **Local mode** — no configuration. Everything lives on the device.
- **Account mode** — set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` and sign in to
  sync metadata across devices for that account.

## Features

- Home, Library, Favorites, Reading Statistics, and Settings
- Import your own PDFs — no curated catalog, only books you add; a soft cover is made from
  the first page and stored offline on the device
- Personal collections, reading statuses, favorites, and a daily reading goal
- Reading themes (match app, paper, sepia, night), typography controls, focus mode, and
  keyboard shortcuts
- PDF reader with page/width fitting, page navigation, zoom, bookmarks, and tonal themes
  that follow the app theme by default
- Text selection with persistent highlights and notes, anchored to PDF character offsets
- Light, dark, and system application themes
- Optional accounts with email + password, row-level-security isolation, and offline-first
  sync that queues changes and replays them when the connection returns
- Password reset by email, in-app password change, and permanent account deletion

## Desktop application

Akshara ships as a native desktop app (Electron) and runs the reader fully offline in its
own window, with a stable `app://akshara` origin for local storage.

Requirements: Node 20+ and Linux (the current installers target Linux x64).

```bash
npm install
npm run app:start   # build + launch the desktop app
```

`npm run dev` starts the Vite UI in a browser for fast interface work. That server is a
development tool only — the product is the Electron app.

```bash
npm run app:dist    # build installers into release/
```

Builds pick up `.env.local`, so the desktop app can sign in to the same account.

On Linux this produces:

- `release/akshara_0.2.1_amd64.deb` — install with `sudo apt install ./release/akshara_0.2.1_amd64.deb`
- `release/Akshara-0.2.1-x86_64.AppImage` — portable build (Ubuntu 24.04+ needs
  `libfuse2t64`; the `.deb` is the safer choice)

Desktop reading data lives in `~/.config/akshara`, separate from any browser profile used
during development. The installer registers the `akshara://` URL scheme so password-reset
links open in the app.

## Accounts and sync (optional)

Sync is off unless a Supabase project is configured, so a plain `npm install && npm run
app:start` works with zero backend.

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

Supabase only sends links to addresses on its allowlist. Because Akshara is desktop-only,
the reset link must come back through the operating system:

- **Site URL:** `http://localhost:5173` (a placeholder; the desktop app never loads it)
- **Redirect URLs:**
  - `akshara://auth/recovery` — required for password reset
  - `akshara://auth/callback` — required for email confirmation links
  - `http://localhost:5173` — only needed if you sign in through `npm run dev`

### Email delivery

Password reset and sign-up emails use Supabase's built-in mailer, which is heavily
rate-limited (a few messages per hour). Connect a transactional provider under
**Authentication → Emails → SMTP Settings** and verify the sender domain before inviting
real readers.

Common providers (use the provider's SMTP credentials, not an API key unless noted):

| Provider | Host | Port | Username | Password |
| --- | --- | --- | --- | --- |
| Resend | `smtp.resend.com` | 465 (SSL) / 587 | `resend` | API key |
| SendGrid | `smtp.sendgrid.net` | 587 | `apikey` | API key |
| Mailgun | `smtp.mailgun.org` | 587 | `postmaster@your-domain` | SMTP password |
| Amazon SES | `email-smtp.<region>.amazonaws.com` | 587 | SES SMTP username | SES SMTP password |
| Gmail (low volume) | `smtp.gmail.com` | 587 | your address | App password (2FA required) |

Set **Sender email** to an address on a domain the provider has verified (for example
`akshara@your-domain.com`) and give it a display name such as “Akshara”. Save, then use
the dashboard's test-email action before relying on it.

Until SMTP is connected, add accounts manually from **Authentication → Users** with
**Auto Confirm User** enabled.

### Password reset

“Forgot password?” emails a link that opens through the `akshara://` handler. The app
registers the scheme at install time, exchanges the link's tokens, and shows the “Choose
a new password” screen. A fresh install may need one sign-out/sign-in before the operating
system picks up the handler.

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
- Offline changes queue in local storage and are pushed on reconnect, focus, or every
  30 seconds while online.
- Conflicts are last-write-wins per record, and a record with an unsent local change
  always wins.
- Deletions travel as `deleted_at` tombstones so they do not reappear from another
  device.
- A book that arrived from the account but has no PDF on this device opens to an
  **Attach the PDF** action that stores the file under the existing book id — your
  place, highlights, and bookmarks are kept.

## Smoke tests

The Playwright suite covers the main routes, the import empty states, importing a PDF
that follows the app theme, favoriting/searching/deleting an imported PDF, the reader
panel focus trap, and the narrow-window layout. It starts its own Vite server and drives
headless Chromium, so neither the desktop app nor a dev server needs to be running. This
is a test harness, not a deployment target.

```bash
npm run test:smoke
```

The suite uses an installed Chrome or Chromium binary. It checks `CHROME_PATH` first, then
common Linux locations. Set it explicitly if needed:

```bash
CHROME_PATH=/path/to/chrome npm run test:smoke
```

## Reading data

Local state is persisted under these storage keys:

- `akshara-library-v1` — library entries, reading positions, collections, bookmarks,
  highlights, imported book metadata, and sessions
- `akshara-settings-v1` — application and reader preferences
- `akshara-sync-v1` — per-account sync bookkeeping (last server timestamps and the
  queue of unsent changes)

Imported PDF files themselves live in IndexedDB (`akshara-files`) because local storage is
too small for books. They never leave the device. Removing an imported PDF from its book
menu deletes both its metadata and its stored file.

Use **Settings → Export copy** to save a JSON backup of library metadata (PDF files are
not included), or **Reset library** to clear your reading state and start fresh.

## Database schema

`supabase/migrations/` holds the full schema: `profiles`, `books`, `library_entries`,
`reading_positions`, `highlights`, `bookmarks`, `collections`, `collection_books`, and
`reading_sessions`. Every table carries a `user_id`, row-level security limits each row
to its owner, deletions are tombstones (`deleted_at`), and `updated_at` is maintained by
triggers.
