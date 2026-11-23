const fs = require("node:fs");
const path = require("node:path");

/**
 * Electron ships a setuid "chrome-sandbox" helper. When it is not owned by root
 * with mode 4755, Chromium aborts the whole app, and user-scoped installs or
 * AppImages can never carry a setuid binary. We drop the helper and route every
 * launch through a small launcher that keeps the user-namespace sandbox when the
 * system allows it and falls back to --no-sandbox when the desktop session
 * forbids it (Ubuntu's AppArmor userns restriction does this under GNOME).
 */
const LAUNCHER = `#!/bin/sh
# Akshara launcher: keep the sandbox when the session supports it, but never
# leave the user with an app that silently refuses to open.
DIR=$(dirname "$(readlink -f "$0")")
OUT=$(mktemp)

"$DIR/akshara-bin" --class=Akshara "$@" >"$OUT" 2>&1 &
PID=$!

I=0
while [ "$I" -lt 20 ]; do
  if grep -q "No usable sandbox" "$OUT" 2>/dev/null; then
    kill "$PID" 2>/dev/null
    wait "$PID" 2>/dev/null
    rm -f "$OUT"
    exec "$DIR/akshara-bin" --class=Akshara --no-sandbox "$@"
  fi
  if ! kill -0 "$PID" 2>/dev/null; then
    break
  fi
  sleep 0.2
  I=$((I + 1))
done

wait "$PID"
STATUS=$?
if [ "$STATUS" -ne 0 ] && grep -Eq "No usable sandbox|SUID sandbox helper" "$OUT"; then
  rm -f "$OUT"
  exec "$DIR/akshara-bin" --class=Akshara --no-sandbox "$@"
fi

rm -f "$OUT"
exit "$STATUS"
`;

module.exports = async function afterPack(context) {
  // The launcher and the setuid helper only exist in the Linux package.
  if (context.electronPlatformName !== "linux") return;

  const appDir = context.appOutDir;
  const executable = path.join(appDir, "akshara");
  const helper = path.join(appDir, "chrome-sandbox");

  if (fs.existsSync(helper)) {
    fs.rmSync(helper, { force: true });
  }

  const realBinary = path.join(appDir, "akshara-bin");
  if (fs.existsSync(executable) && !fs.existsSync(realBinary)) {
    fs.renameSync(executable, realBinary);
    fs.writeFileSync(executable, LAUNCHER, { mode: 0o755 });
    fs.chmodSync(executable, 0o755);
  }
};
