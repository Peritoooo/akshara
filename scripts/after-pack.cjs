const fs = require("node:fs");
const path = require("node:path");

/**
 * Electron ships a setuid "chrome-sandbox" helper. When it is not owned by root
 * with mode 4755, Chromium aborts the whole app. User-scoped installs and
 * AppImages can never carry a setuid binary, so we drop the helper and let
 * Chromium use its user-namespace sandbox, which keeps renderers isolated on
 * every current Linux distribution.
 */
module.exports = async function afterPack(context) {
  const helper = path.join(context.appOutDir, "chrome-sandbox");
  if (fs.existsSync(helper)) {
    fs.rmSync(helper, { force: true });
  }
};
