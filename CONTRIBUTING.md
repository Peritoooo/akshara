# Contributing

Thanks for taking a look. Akshara is a small, opinionated desktop app; the bar
for changes is "does this make reading calmer and more reliable?"

## Setup

```bash
npm install
npm run app:start   # build and launch the desktop app
```

`npm run dev` starts the Vite UI in a browser for fast interface work. The
product is the Electron app, so check shell behaviour with `npm run app:start`.

## Tests

```bash
npx tsc -b          # types
npm run test:smoke  # browser UI suite
npm run test:e2e    # real Electron shell + deep links
npm test            # both suites
```

The Electron suite needs an X11 or Wayland session. On a headless machine:

```bash
xvfb-run --auto-servernum npm test
```

Please run `npx tsc -b` and the relevant suite before opening a pull request.

## Style

- TypeScript strict mode; no `any` unless the alternative is worse.
- Follow the surrounding components, naming, and Tailwind conventions.
- Keep the reader calm: avoid new chrome unless it earns its place.
- Prefer the platform over new dependencies.

## Accounts and secrets

- Never commit `.env.local`, SMTP credentials, service-role keys, or access
  tokens. Only the public Supabase `anon` key belongs in `.env.local`.
- Tests must not need a Supabase project; they build a local-only bundle.
- Account deletion and RLS changes belong in `supabase/migrations/` as a new
  timestamped file.

## Pull requests

- One focused change per PR.
- Describe the user-visible result and how you tested it.
- Screenshots help for UI work.
- By contributing you agree your work is licensed under the MIT License.
