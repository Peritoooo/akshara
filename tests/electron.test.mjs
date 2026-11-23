import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test, { after, before } from "node:test";
import { _electron as electron } from "playwright-core";
import { build } from "vite";

const require = createRequire(import.meta.url);
const { findAuthLink } = require("../electron/authLink.cjs");

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const fixturePdf = path.join(projectRoot, "tests", "fixtures", "sample.pdf");
const hasDisplay = Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
const skip = hasDisplay ? false : "needs a graphical session (DISPLAY or WAYLAND_DISPLAY)";

let tempRoot;
let distDir;
let profileDir;
let app;
let page;

async function launchApp() {
  const instance = await electron.launch({
    args: [projectRoot, "--no-sandbox", `--user-data-dir=${profileDir}`],
    cwd: projectRoot,
    env: {
      ...process.env,
      // Point the shell at the local-only bundle built in `before`.
      AKSHARA_DIST_DIR: distDir,
      // Keep window state, storage, and the single-instance lock away from the
      // real `~/.config/akshara` profile.
      XDG_CONFIG_HOME: path.join(tempRoot, "config"),
      ELECTRON_DISABLE_SECURITY_WARNINGS: "1",
    },
    timeout: 60_000,
  });
  const window = await instance.firstWindow();
  await window.waitForLoadState("domcontentloaded");
  return { instance, window };
}

before(async () => {
  if (!hasDisplay) return;

  tempRoot = await mkdtemp(path.join(tmpdir(), "akshara-e2e-"));
  distDir = path.join(tempRoot, "dist");
  profileDir = path.join(tempRoot, "profile");

  // Build the app without `.env.local`, so the suite exercises the local-only
  // product path without a Supabase project or network access.
  await build({
    root: projectRoot,
    envDir: false,
    logLevel: "error",
    build: { outDir: distDir, emptyOutDir: true },
  });

  ({ instance: app, window: page } = await launchApp());
});

after(async () => {
  await app?.close().catch(() => undefined);
  if (tempRoot) await rm(tempRoot, { recursive: true, force: true });
});

test("finds akshara links in startup and second-instance argv", () => {
  const link = "akshara://auth/recovery#access_token=a&refresh_token=b&type=recovery";
  assert.equal(findAuthLink(["/opt/Akshara/akshara", link]), link);
  assert.equal(
    findAuthLink(["/opt/Akshara/akshara", "--no-sandbox", link, "--flag"]),
    link,
  );
  assert.equal(findAuthLink(["/opt/Akshara/akshara", "https://example.com"]), null);
  assert.equal(findAuthLink([]), null);
  assert.equal(findAuthLink(null), null);
});

test("opens the shell at app://akshara with the desktop bridge", { skip }, async () => {
  assert.ok(page.url().startsWith("app://akshara/"), page.url());
  assert.match(await page.title(), /Akshara/);

  const bridge = await page.evaluate(() => ({
    present: Boolean(window.aksharaDesktop),
    onAuthLink: typeof window.aksharaDesktop?.onAuthLink,
    getAuthLink: typeof window.aksharaDesktop?.getAuthLink,
  }));
  assert.deepEqual(bridge, {
    present: true,
    onAuthLink: "function",
    getAuthLink: "function",
  });
});

test("shows the local library without a sign-in gate", { skip }, async () => {
  await page.getByText("Your reading room is quiet and ready.").waitFor({
    timeout: 30_000,
  });
  assert.equal(await page.getByText("Welcome back").count(), 0);
  assert.ok(await page.getByRole("button", { name: "Add a PDF" }).first().isVisible());
});

test("imports a PDF and opens it in the reader", { skip }, async () => {
  await page.getByRole("button", { name: "Add a PDF" }).first().click();
  await page.locator('input[type="file"]').setInputFiles(fixturePdf);
  await page.getByText(/Ready to shelve/i).waitFor({ timeout: 60_000 });
  await page.getByRole("button", { name: /Add & read/i }).click();

  await page.waitForURL(/\/read\/imported-/, { timeout: 30_000 });
  await page.locator("canvas").first().waitFor({ timeout: 60_000 });
});

test("keeps the imported library after a restart", { skip }, async () => {
  await app.close();
  ({ instance: app, window: page } = await launchApp());

  await page.goto("app://akshara/library", { waitUntil: "domcontentloaded" });
  await page.locator("article").first().waitFor({ timeout: 30_000 });
});

test("offers Check for Updates in the Help menu", { skip }, async () => {
  const menu = await app.evaluate(({ Menu, app: electronApp }) => {
    const applicationMenu = Menu.getApplicationMenu();
    const help = applicationMenu?.items.find((item) => item.label === "Help");
    return {
      items: help?.submenu?.items.map((item) => item.label) ?? [],
      version: electronApp.getVersion(),
    };
  });

  assert.ok(menu.items.includes("Check for Updates…"));
  assert.equal(menu.items.at(-1), `Akshara ${menu.version}`);
});

test("forwards akshara:// links to the renderer", { skip }, async () => {
  const link =
    "akshara://auth/recovery#access_token=test&refresh_token=test&type=recovery";

  await page.evaluate(() => {
    window.__aksharaLink = null;
    window.aksharaDesktop.onAuthLink((url) => {
      window.__aksharaLink = url;
    });
  });

  await app.evaluate(({ BrowserWindow }, url) => {
    BrowserWindow.getAllWindows()[0]?.webContents.send("akshara:auth-link", url);
  }, link);

  await page.waitForFunction(() => Boolean(window.__aksharaLink));
  assert.equal(await page.evaluate(() => window.__aksharaLink), link);
});
