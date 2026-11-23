/**
 * Startup argument parsing lives in its own module so it can be tested without
 * launching Electron. `argv` is either the app's own process args or the args
 * handed to the `second-instance` event when another window tries to open.
 */
const AUTH_LINK_PREFIX = "akshara://";

function findAuthLink(argv) {
  if (!Array.isArray(argv)) return null;
  return (
    argv.find(
      (arg) => typeof arg === "string" && arg.startsWith(AUTH_LINK_PREFIX),
    ) ?? null
  );
}

module.exports = { AUTH_LINK_PREFIX, findAuthLink };
