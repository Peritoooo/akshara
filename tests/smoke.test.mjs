import { existsSync } from "node:fs";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test, { after, before } from "node:test";
import { createServer } from "vite";
import { chromium } from "playwright-core";

let server;
let browser;
let baseURL;

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

before(async () => {
  server = await createServer({
    // Smoke tests exercise the local-only app; skip .env.local so a Supabase
    // project configured for development does not gate the library behind auth.
    envDir: false,
    server: { host: "127.0.0.1", port: 5199, strictPort: true },
    logLevel: "error",
  });
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not determine the Vite dev server address.");
  }
  baseURL = `http://127.0.0.1:${address.port}`;

  const executablePath = CHROME_CANDIDATES.find((candidate) =>
    existsSync(candidate),
  );
  if (!executablePath) {
    throw new Error(
      "No Chrome binary found. Set CHROME_PATH to a Chrome or Chromium executable.",
    );
  }
  browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ["--no-sandbox"],
  });
});

after(async () => {
  await browser?.close();
  await server?.close();
});

async function openPage(viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return {
    page,
    errors,
    async close() {
      await context.close();
    },
  };
}

/**
 * Imports tests/fixtures/sample.pdf from the Library page and returns the
 * reader URL of the imported book.
 */
async function importSamplePdf(page) {
  const pdfPath = fileURLToPath(
    new URL("./fixtures/sample.pdf", import.meta.url),
  );
  await page.goto(`${baseURL}/library`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Add PDF" }).first().click();
  await page.locator('input[type="file"]').setInputFiles(pdfPath);
  await page.getByText(/Ready to shelve/i).waitFor({
    state: "visible",
    timeout: 45_000,
  });
  await page.getByRole("button", { name: /Add & read/i }).click();
  await page.waitForURL(/\/read\/imported-/, { timeout: 30_000 });
  await page.locator("canvas").first().waitFor({
    state: "visible",
    timeout: 45_000,
  });
  return page.url();
}

test("core routes render without console errors", { timeout: 90_000 }, async () => {
  const { page, errors, close } = await openPage();
  try {
    const routes = [
      ["/", /Good (morning|afternoon|evening|night)/],
      ["/library", /My Library/],
      ["/favorites", /Favorites/],
      ["/stats", /Reading, in numbers\./],
      ["/settings", /Settings/],
    ];
    for (const [route, expected] of routes) {
      await page.goto(`${baseURL}${route}`, {
        waitUntil: "domcontentloaded",
      });
      const heading = page.locator("h1").first();
      await heading.waitFor({ state: "visible" });
      assert.match(await heading.innerText(), expected, `heading on ${route}`);
    }

    // The catalog is gone: the app starts with an empty shelf.
    await page.goto(`${baseURL}/library`, { waitUntil: "domcontentloaded" });
    await page.getByText(/Your shelf is waiting/).waitFor({ state: "visible" });
    assert.equal(await page.locator("article").count(), 0);
    assert.deepEqual(errors, []);
  } finally {
    await close();
  }
});

test("home shows the import empty state", { timeout: 60_000 }, async () => {
  const { page, errors, close } = await openPage();
  try {
    await page.goto(baseURL, { waitUntil: "domcontentloaded" });
    await page.getByText(/Bring in your first book/).waitFor({
      state: "visible",
    });
    const addButtons = page.getByRole("button", { name: "Add a PDF" });
    assert.ok((await addButtons.count()) >= 2, "hero and header import CTAs");
    assert.equal(await page.locator("article").count(), 0);
    assert.deepEqual(errors, []);
  } finally {
    await close();
  }
});

test("imported PDF follows the app theme and can be read, found, and deleted", { timeout: 150_000 }, async () => {
  const { page, errors, close } = await openPage();
  try {
    const readerURL = await importSamplePdf(page);

    // The stored book and its file.
    const saved = await page.evaluate(() => {
      const state = JSON.parse(
        localStorage.getItem("akshara-library-v1") ?? "{}",
      ).state;
      return state.customBooks.map((book) => ({
        id: book.id,
        custom: book.custom,
        pages: book.pages,
        cover: book.coverImage?.startsWith("data:image/") ?? false,
        entryStatus: state.entries[book.id]?.status,
      }));
    });
    assert.equal(saved.length, 1, "one imported PDF is stored");
    assert.equal(saved[0].custom, true);
    assert.equal(saved[0].pages, 12);
    assert.equal(saved[0].cover, true, "first-page cover thumbnail exists");
    assert.equal(saved[0].entryStatus, "reading");

    const fileCount = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const request = indexedDB.open("akshara-files", 1);
          request.onsuccess = () => {
            const db = request.result;
            const count = db
              .transaction("pdfs", "readonly")
              .objectStore("pdfs")
              .count();
            count.onsuccess = () => resolve(count.result);
            count.onerror = () => resolve(0);
          };
          request.onerror = () => resolve(0);
        }),
    );
    assert.equal(fileCount, 1, "the PDF bytes are stored in IndexedDB");

    // Theme-follow: with the app in light mode the reader follows.
    const readerTheme = () =>
      page.getAttribute("[data-reader-theme]", "data-reader-theme");
    assert.equal(await readerTheme(), "light");

    // Flip the app theme to charcoal and the reading room follows.
    await page.goto(`${baseURL}/settings`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Charcoal" }).click();
    await page.waitForFunction(() => {
      const state = JSON.parse(
        localStorage.getItem("akshara-settings-v1") ?? "{}",
      );
      return (
        state?.state?.theme === "dark" &&
        state?.state?.reader?.theme === "follow"
      );
    });
    await page.goto(readerURL, { waitUntil: "domcontentloaded" });
    await page.locator("canvas").first().waitFor({
      state: "visible",
      timeout: 45_000,
    });
    assert.equal(await readerTheme(), "dark");
    const isDark = await page.evaluate(() =>
      document.documentElement.classList.contains("dark"),
    );
    assert.equal(isDark, true, "reading dialogs and toasts adopt dark too");

    // Favoriting happens on the book's own page.
    const bookId = saved[0].id;
    await page.goto(`${baseURL}/book/${bookId}`, {
      waitUntil: "domcontentloaded",
    });
    await page.locator("h1").first().waitFor();
    const favorite = page
      .getByRole("button", { name: /^Favorite$|^Favorited$/ })
      .first();
    await favorite.click();
    await page.waitForFunction((id) => {
      const state = JSON.parse(localStorage.getItem("akshara-library-v1") ?? "{}");
      return state?.state?.entries?.[id]?.favorite === true;
    }, bookId);
    assert.match(await favorite.innerText(), /Favorited/);
    await favorite.click();
    await page.waitForFunction((id) => {
      const state = JSON.parse(localStorage.getItem("akshara-library-v1") ?? "{}");
      return state?.state?.entries?.[id]?.favorite === false;
    }, bookId);

    // Search narrows the shelf to the imported title.
    await page.goto(`${baseURL}/library`, { waitUntil: "domcontentloaded" });
    const search = page.getByRole("searchbox", { name: "Search your library" });
    await search.waitFor();
    await search.fill("sample");
    await page.waitForFunction(
      () => document.querySelectorAll("article").length === 1,
    );
    assert.match(
      await page.locator("article").first().innerText(),
      /Sample/i,
    );

    // Deleting removes both the metadata and the stored file.
    await page
      .getByRole("button", { name: /More options for Sample/i })
      .first()
      .click();
    await page.getByRole("menuitem", { name: /Delete imported PDF/i }).click();
    await page.getByRole("button", { name: "Delete PDF" }).click();
    await page.waitForFunction(() => {
      const state = JSON.parse(
        localStorage.getItem("akshara-library-v1") ?? "{}",
      ).state;
      return state.customBooks.length === 0;
    });
    const fileCountAfterDelete = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const request = indexedDB.open("akshara-files", 1);
          request.onsuccess = () => {
            const db = request.result;
            const count = db
              .transaction("pdfs", "readonly")
              .objectStore("pdfs")
              .count();
            count.onsuccess = () => resolve(count.result);
            count.onerror = () => resolve(0);
          };
          request.onerror = () => resolve(0);
        }),
    );
    assert.equal(fileCountAfterDelete, 0, "the PDF file was removed too");
    assert.deepEqual(errors, []);
  } catch (error) {
    throw error;
  } finally {
    await close();
  }
});

test("reader panel traps focus and returns it to the trigger", { timeout: 120_000 }, async () => {
  const { page, errors, close } = await openPage();
  try {
    await importSamplePdf(page);
    await page.waitForTimeout(1200);

    const trigger = page.locator('button[aria-label="Contents"]').first();
    await trigger.click();
    const dialog = page.locator('section[role="dialog"]');
    await dialog.waitFor({ state: "visible" });

    const focusState = () =>
      page.evaluate(() => {
        const active = document.activeElement;
        return (
          active?.getAttribute("aria-label") ||
          active?.getAttribute("title") ||
          active?.tagName ||
          ""
        );
      });
    assert.equal(await focusState(), "Close panel");

    const edgeLabels = await page.evaluate(() => {
      const panel = document.querySelector('section[role="dialog"]');
      const items = [
        ...panel.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((element) => element.offsetParent !== null);
      const label = (element) =>
        element?.getAttribute("aria-label") ||
        element?.getAttribute("title") ||
        element?.tagName ||
        "";
      return {
        first: label(items[0]),
        last: label(items[items.length - 1]),
      };
    });

    const focusEdge = (edge) =>
      page.evaluate((which) => {
        const panel = document.querySelector('section[role="dialog"]');
        const items = [
          ...panel.querySelectorAll(
            'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ].filter((element) => element.offsetParent !== null);
        items[which === "first" ? 0 : items.length - 1]?.focus();
      }, edge);

    await focusEdge("first");
    await page.keyboard.press("Shift+Tab");
    assert.equal(
      await focusState(),
      edgeLabels.last,
      "Shift+Tab from the first item wraps to the last item",
    );

    await focusEdge("last");
    await page.keyboard.press("Tab");
    assert.equal(
      await focusState(),
      edgeLabels.first,
      "Tab from the last item wraps to the first item",
    );

    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached" });
    await page.waitForTimeout(200);
    assert.equal(await focusState(), "Contents");
    assert.deepEqual(errors, []);
  } catch (error) {
    throw error;
  } finally {
    await close();
  }
});

test("mobile layout has no horizontal page overflow", { timeout: 60_000 }, async () => {
  const { page, errors, close } = await openPage({ width: 390, height: 844 });
  try {
    await page.goto(baseURL, { waitUntil: "domcontentloaded" });
    await page.locator("h1").first().waitFor();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    assert.ok(overflow <= 0, `unexpected horizontal overflow: ${overflow}px`);

    await page.getByRole("link", { name: "Library", exact: true }).click();
    await page.waitForURL("**/library");
    const libraryHeading = page.locator("h1", { hasText: "My Library" });
    await libraryHeading.waitFor({ state: "visible" });
    assert.match(await libraryHeading.innerText(), /My Library/);
    assert.deepEqual(errors, []);
  } catch (error) {
    throw error;
  } finally {
    await close();
  }
});
