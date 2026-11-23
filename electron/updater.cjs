/**
 * Auto-update is only possible for builds the updater can replace:
 * Windows/macOS bundles, and the Linux AppImage (which exposes APPIMAGE).
 * A `.deb` install updates through the system package manager instead.
 * On macOS the install step additionally needs a signed app.
 */
function canAutoUpdate({ isPackaged, platform, appImageEnv }) {
  if (!isPackaged) return false;
  if (platform === "linux") return Boolean(appImageEnv);
  return true;
}

module.exports = { canAutoUpdate };
