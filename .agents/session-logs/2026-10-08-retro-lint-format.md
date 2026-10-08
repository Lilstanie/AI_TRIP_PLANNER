---
date: 2026-10-08
author: Claude Code (Sonnet 5.5)
branch: chore/retro-lint-format
pr: none
area: root config, .github, packages, docs
contract-impact: none
---

# Lint every package and check Prettier on changed files only

## What changed

- Each of `packages/{shared,agents,orchestrator,services,tools}` has a `lint` script running ESLint with
  the new root `eslint.config.mjs` (typescript-eslint recommended); `eslint`, `@eslint/js` and
  `typescript-eslint` were added with `pnpm add -D`.
- Lint fixes: removed unused imports in `agents` (accommodation, transport) and `orchestrator`
  (`agent-lab/run.ts`, `workflow.ts`), dropped a useless regex escape in `chat-offline.ts`, and a file-level
  disable with a reason in `tools/tests/public-boundary.test.ts`.
- `scripts/format-check-changed.mjs` plus `pnpm format:check-changed`, run in the CI `check` job (now
  `fetch-depth: 0`) against the PR base or the previous push tip; skips deleted, ignored and unsupported files.
- `pre-push-checks` skill and `docs/development.md` (+ `.zh.md`) describe both.

## Why

Packages had no lint, so a green `pnpm lint` said nothing about them (retro item 3). A repo-wide Prettier
check or `pnpm format` would fail on untouched files and conflict with PRs #229 and #230 (retro item 4).
Joey approved the `.github/**` and root config changes on 2026-10-08.
`.toFixed(2)` ban is not copied from `apps/web`: about 30 package hits and the Money module is web-only.
`no-explicit-any` is off under `tests/` (4 hits).

## Validation

`pnpm lint` (6 of 6 tasks), `pnpm typecheck` (6 of 6), `pnpm test` (shared 52, services 4, tools 128,
agents 124, orchestrator 227, web 596 passed), `pnpm test:scripts` (26 passed), `pnpm verify:docs`,
`pnpm verify:pairs` (24 pairs) and `pnpm verify:protected origin/main` all passed.
`node scripts/format-check-changed.mjs origin/main` was run against the committed diff.

## Notes for the next person

Unformatted files remain; fix them only when you touch them. `next lint` is deprecated in Next 16.
