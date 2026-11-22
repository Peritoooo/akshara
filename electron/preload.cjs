const { contextBridge, ipcRenderer } = require("electron");

// The main process forwards `akshara://auth/...` links here. Auth links carry
// short-lived tokens, so they are handed over as a string and never logged.
contextBridge.exposeInMainWorld("aksharaDesktop", {
  onAuthLink(handler) {
    const listener = (_event, url) => {
      if (typeof url === "string") handler(url);
    };
    ipcRenderer.on("akshara:auth-link", listener);
    return () => ipcRenderer.removeListener("akshara:auth-link", listener);
  },
  /** A link that arrived before the window finished loading. */
  getAuthLink() {
    return ipcRenderer.invoke("akshara:get-auth-link");
  },
});
