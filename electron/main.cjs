const {
  app,
  BrowserWindow,
  Menu,
  ipcMain,
  net,
  protocol,
  shell,
} = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { Readable } = require("node:stream");
const { findAuthLink } = require("./authLink.cjs");

const APP_SCHEME = "app";
const APP_HOST = "akshara";
const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;

/** Password-reset / sign-in links delivered by the operating system. */
const AUTH_SCHEME = "akshara";

const ROOT = path.join(__dirname, "..");
// Tests build a throwaway bundle (without Supabase) and point the shell at it.
const DIST_DIR = process.env.AKSHARA_DIST_DIR
  ? path.resolve(process.env.AKSHARA_DIST_DIR)
  : path.join(ROOT, "dist");
const ICON_PATH = path.join(ROOT, "build", "icon.png");
const STATE_PATH = () => path.join(app.getPath("userData"), "window-state.json");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".wasm": "application/wasm",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".pdf": "application/pdf",
  ".webmanifest": "application/manifest+json",
};

// The renderer is served from a standard, secure origin so that IndexedDB,
// module workers (pdf.js) and history routing all behave like a normal site.
protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
    },
  },
]);

function resolveAsset(pathname) {
  const decoded = decodeURIComponent(pathname.split("?")[0].split("#")[0]);
  const relative = decoded.replace(/^\/+/, "");
  const candidate = path.resolve(DIST_DIR, relative);
  if (!candidate.startsWith(DIST_DIR + path.sep) && candidate !== DIST_DIR) {
    return null;
  }
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return candidate;
  }
  // Unknown paths are client-side routes: hand them the app shell.
  return path.join(DIST_DIR, "index.html");
}

function registerAppProtocol() {
  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url);
    const filePath = resolveAsset(url.pathname);
    if (!filePath) {
      return new Response("Forbidden", { status: 403 });
    }

    const extension = path.extname(filePath).toLowerCase();
    const headers = {
      "content-type": MIME_TYPES[extension] ?? "application/octet-stream",
      "cache-control": "no-cache",
    };

    if (request.method === "HEAD") {
      headers["content-length"] = String(fs.statSync(filePath).size);
      return new Response(null, { headers });
    }

    const stream = Readable.toWeb(fs.createReadStream(filePath));
    return new Response(stream, { headers });
  });
}

function readWindowState() {
  try {
    const raw = fs.readFileSync(STATE_PATH(), "utf8");
    const parsed = JSON.parse(raw);
    if (
      Number.isFinite(parsed.width) &&
      Number.isFinite(parsed.height) &&
      parsed.width >= 480 &&
      parsed.height >= 400
    ) {
      return parsed;
    }
  } catch {
    /* first launch */
  }
  return null;
}

function saveWindowState(win) {
  if (!win || win.isDestroyed() || win.isMinimized() || win.isFullScreen()) return;
  const bounds = win.getNormalBounds();
  try {
    fs.writeFileSync(STATE_PATH(), JSON.stringify(bounds), "utf8");
  } catch {
    /* state is a convenience, never fatal */
  }
}

function buildMenu() {
  const template = [
    ...(process.platform === "darwin"
      ? [{ role: "appMenu" }]
      : []),
    {
      label: "File",
      submenu: [{ role: "quit", label: "Quit Akshara" }],
    },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

let mainWindow = null;
let pendingAuthLink = null;

function deliverAuthLink(url) {
  if (!url) return;
  // Keep it until the renderer asks for it, in case the window is not ready.
  pendingAuthLink = url;
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const send = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send("akshara:auth-link", url);
  };

  if (mainWindow.webContents.isLoading()) {
    mainWindow.webContents.once("did-finish-load", send);
  } else {
    send();
  }
}

function createWindow() {
  const saved = readWindowState();

  mainWindow = new BrowserWindow({
    width: saved?.width ?? 1280,
    height: saved?.height ?? 860,
    x: saved?.x,
    y: saved?.y,
    minWidth: 480,
    minHeight: 400,
    title: "Akshara",
    icon: fs.existsSync(ICON_PATH) ? ICON_PATH : undefined,
    backgroundColor: "#F7F5F0",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      webSecurity: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("resize", () => saveWindowState(mainWindow));
  mainWindow.on("move", () => saveWindowState(mainWindow));
  mainWindow.on("close", () => saveWindowState(mainWindow));

  // Keep navigation inside the app; hand real web links to the system browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(APP_ORIGIN)) {
      event.preventDefault();
      if (url.startsWith("http://") || url.startsWith("https://")) {
        void shell.openExternal(url);
      }
    }
  });

  mainWindow.webContents.on("context-menu", (_event, params) => {
    // Let the operating system handle text editing and selected-text actions.
    if (!params.isEditable && !params.selectionText) return;
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  void mainWindow.loadURL(`${APP_ORIGIN}/`);

  return mainWindow;
}

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    deliverAuthLink(findAuthLink(argv));
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  // macOS delivers custom-scheme links through this event instead of argv.
  app.on("open-url", (event, url) => {
    event.preventDefault();
    deliverAuthLink(url);
  });

  app.setName("Akshara");
  if (process.platform === "linux") {
    // Associate the window with akshara.desktop so the dock and app grid show
    // the Akshara icon instead of a generic Electron window.
    app.setDesktopName("akshara.desktop");
  }
  if (process.platform !== "darwin") {
    // Lets the mail client open password-reset links in this app.
    app.setAsDefaultProtocolClient(AUTH_SCHEME);
  }

  app.whenReady().then(() => {
    registerAppProtocol();
    ipcMain.handle("akshara:get-auth-link", () => {
      const url = pendingAuthLink;
      pendingAuthLink = null;
      return url;
    });
    buildMenu();
    createWindow();
    deliverAuthLink(findAuthLink(process.argv));

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
