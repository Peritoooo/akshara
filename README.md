# Akshara (अक्षर)

**Every letter opens a new world.**

A local-first digital reading app built around a warm, editorial interface. Your reading
room starts empty — bring in your own PDFs and read them in a comfortable,
distraction-free reader that follows the website theme.

## Features

- Home, Library, Favorites, Reading Statistics, and Settings
- Import your own PDFs — no curated catalog, only books you add; cover made from the
  first page, stored offline in this browser
- Personal collections, reading statuses, favorites, and a daily reading goal
- Reading themes (match website, paper, sepia, night), typography controls, focus mode,
  and keyboard shortcuts
- PDF reader with page/width fitting, page navigation, zoom, bookmarks, and tonal themes
  that follow the website theme by default
- Responsive sidebar and mobile navigation
- Light, dark, and system application themes
- All reading state stored locally in the browser

## Getting started

```bash
npm install
npm run dev
```

Then open the URL printed by Vite (usually `http://127.0.0.1:5173/`).

## Build

```bash
npm run build
npm run preview
```

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

State is persisted under two `localStorage` keys:

- `akshara-library-v1` — library entries, reading positions, collections, bookmarks,
  highlights, imported book metadata, and sessions
- `akshara-settings-v1` — application and reader preferences

Imported PDF files themselves live in IndexedDB (`akshara-files`), because
`localStorage` is too small for books. They never leave the device. Removing an imported
PDF from its book menu deletes both its metadata and its stored file. Resetting the demo
does the same for every imported PDF.

Use **Settings → Export copy** to download a JSON backup of library metadata (the PDF
files are not included), or **Reset demo** to clear your local reading state and start
fresh.
