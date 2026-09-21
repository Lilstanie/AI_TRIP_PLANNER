# Agent Note: Link apps/web/.env.local to the root file on install

Status: implemented
Owner: A (@Lilstanie)

## Problem

Documentation and `.env.example` put local secrets in the repository root `.env.local`, but
Next.js only loads `.env*` files from the directory it runs in (`apps/web`). The web app silently
ran without keys, and live providers fell back without saying why.

## Decision

`scripts/link-env.mjs` runs as the root `postinstall` script and symlinks
`apps/web/.env.local -> ../../.env.local` whenever the root file exists. It is idempotent, leaves a
real file at that path alone with a warning, and prints the manual command instead of failing
`pnpm install` when symlinks are not permitted. The setup steps are in
[development.md](../../../../docs/development.md).

## Alternatives considered

**Load the root file from `next.config.mjs` with `@next/env`.** Tried and reverted: Next's dev
bundler reloads environment variables from `apps/web` once it starts watching and discards what the
config loaded. A temporary route confirmed `USE_MOCK_TOOLS` was unset at runtime.

**Keep a hand-populated `apps/web/.env.local`.** Rejected: it is untracked, undocumented and
drifts from the root file.

## Consequences

- Recreating the root `.env.local` needs another `pnpm install` to restore the link.
- Windows needs Developer Mode for the symlink. Vercel injects variables directly and is unaffected.

## Sources

[2026-09-21 env.local log](../../../session-logs/2026-09-21-env-local-monorepo-root.md) and
[2026-09-09 MiniMax endpoint log](../../../session-logs/2026-09-09-minimax-endpoint-fix.md), which found the defect.
