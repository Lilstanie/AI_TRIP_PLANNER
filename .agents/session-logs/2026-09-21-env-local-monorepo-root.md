## Session summary

- Author: Claude.
- Date: 2026-09-21 (Australia/Sydney).
- Module(s): repo tooling (`scripts/link-env.mjs`, root `package.json`), `docs/development.md`.
- Goal / requirement source: fix the root cause behind the "Fourth defect" noted in
  `2026-09-09-minimax-endpoint-fix.md` — `next dev`/`build`/`start` never read the monorepo-root
  `.env.local` the rest of the docs and `.env.example` assume, because Next only loads `.env*`
  files from the directory it runs in (`apps/web`), with no config option to point it elsewhere.
  That session worked around it by hand-populating `apps/web/.env.local`; this one closes the gap
  for every contributor automatically.
- Root cause, confirmed: before any fix, `next dev` printed no `- Environments: ...` line at all.
  A manual `apps/web/.env.local -> ../../.env.local` symlink fixed it (`- Environments: .env.local`
  appeared, `SERPAPI_KEY`/`USE_MOCK_TOOLS` took effect) — but the symlink is untracked (matches the
  `.env*` gitignore rule) and undocumented, so it doesn't survive a clean clone.
- First attempt, rejected: loading the root `.env.local` explicitly from `apps/web/next.config.mjs`
  via `@next/env`'s `loadEnvConfig()`. This looked correct at config-parse time, but Next's dev
  bundler (`server/lib/router-utils/setup-dev-bundler.js`) unconditionally force-reloads env vars
  from the server's own directory (`apps/web`) once the dev server starts watching, discarding
  whatever a custom `next.config.mjs` had loaded from elsewhere. Verified empirically: a temporary
  `/api/envcheck-debug` route returned `USE_MOCK_TOOLS: null` even with the `@next/env` call in
  place. Reverted `next.config.mjs` and the `@next/env` dependency entirely — not worth the added
  indirection for a mechanism Next's own dev server silently undoes.
- What was done: added `scripts/link-env.mjs`, wired as the root `postinstall` script. It symlinks
  `apps/web/.env.local -> ../../.env.local` whenever the root file exists, is idempotent, skips
  (with a warning) if a non-symlink file already occupies that path, and degrades to a printed
  manual-command warning instead of failing `pnpm install` if symlink creation isn't permitted
  (e.g. Windows without Developer Mode). This makes Next's *own* env loading and dev-time hot
  reload work correctly, rather than fighting it. Documented the mechanism and the Windows caveat
  in `docs/development.md`.
- Files changed: `scripts/link-env.mjs` (new), `package.json` (`postinstall` script),
  `docs/development.md`, this log.
- Contract impact: none.
- Assumptions: every local dev/build/start invocation runs through `pnpm install` at least once
  after `.env.local` is created or recreated; CI/Vercel are unaffected since Vercel injects env
  vars directly into the process regardless of file layout.
- Verification: removed the pre-existing manual symlink, ran `pnpm install` from that clean state,
  confirmed `scripts/link-env.mjs` recreated `apps/web/.env.local -> ../../.env.local` and is a
  no-op on a second run. Ran `next dev` (isolated via `NEXT_DIST_DIR`) and confirmed the startup
  banner printed `- Environments: .env.local`. Added a temporary `/api/envcheck-debug` route
  returning `process.env.USE_MOCK_TOOLS` / `Boolean(process.env.SERPAPI_KEY)`, hit it, and got
  `{"USE_MOCK_TOOLS":"false","SERPAPI_KEY_set":true}` — matching the root `.env.local` values —
  then deleted the route.
- Open issues / TODO: none for this fix. `docs/development.md`'s "Environment variables" table was
  left as is; only the setup-step section changed.
