# Security policy

## Supported versions

Security fixes land on the latest release. Older releases are not patched.

| Version | Supported |
| --- | --- |
| 0.3.x | ✅ |
| < 0.3 | ❌ |

## Reporting a vulnerability

Please **do not** open a public issue for a security problem.

Use GitHub's private vulnerability reporting:

**https://github.com/Peritoooo/akshara/security/advisories/new**

Include:

- what the issue is and who it affects
- steps to reproduce
- the version and platform you tested

You should get an acknowledgement within a few days. Please give me a chance
to ship a fix before disclosing the issue publicly.

## What is in scope

- The desktop app (`electron/`, `src/`)
- Authentication and the Supabase schema/RLS policies (`supabase/migrations/`)
- The sync engine (`src/lib/sync.ts`, `src/store/session.ts`)
- Release artifacts and the update feed

## What is not in scope

- PDF files themselves. They never leave the device, so they are outside the
  sync and account surface.
- Third-party services (Supabase, GitHub, your mail provider).
- Issues that require the victim's unlocked device or admin access to it.
