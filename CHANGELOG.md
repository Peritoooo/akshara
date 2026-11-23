# Changelog

## 0.3.0

- Automatic updates for Windows and the Linux AppImage. macOS uses the same flow
  once builds are signed. `.deb` installs keep using the release page.
- Signed-in checks after launch, plus a **Help → Check for Updates…** action that
  reports progress, availability, and install prompts.
- Windows (NSIS) and macOS (dmg/zip, Intel + Apple Silicon) packaging alongside
  the existing Linux `.deb` and AppImage.
- CI on every push and PR: typecheck, build, browser smoke suite, and the
  Electron end-to-end suite.
- Tag-driven release workflow that builds all platforms and publishes installers
  plus update metadata.
- Public-repo docs: license, security policy, contributing guide, issue forms.

## 0.2.2

- **Help → Check for Updates…** opens the latest release.
- Electron end-to-end tests for the shell, preload bridge, local library, PDF
  import, restart persistence, and `akshara://` delivery.

## 0.2.1

- Desktop-only distribution; removed the web/Vercel path.
- Email confirmation links return through `akshara://auth/callback`.
- Interface copy now talks about the device, not a browser.

## 0.2.0

- Accounts, offline-first metadata sync, multi-device libraries.
- Password reset with desktop deep links, in-app password change, and permanent
  account deletion.

## 0.1.0

- First desktop release: themed PDF reader, highlights, collections, stats, and
  local-only storage.
