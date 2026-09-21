---
date: 2026-09-22
author: Claude Code, with @HeadmasterEggy
branch: docs/package-readmes
pr: none
area: packages/*, apps/web, docs, scripts
contract-impact: none
---

# A README for every package and the web app

## What changed

- `README.md` in `packages/{shared,services,tools,agents,orchestrator}` and `apps/web`: purpose,
  owner, exports, the environment variables the package itself reads, the invariants callers rely
  on, and how to test it. Details link to `docs/` and Agent Notes instead of being copied.
- `docs/AGENTS.md` names package READMEs as the home for a package's exports, configuration and
  invariants; `scripts/verify-docs.mjs` checks their links.
- `architecture.md` no longer says `MemoryStore` is an in-process `Map`; a `budget.ts` comment no
  longer mentions HITL.

## Why

DeepSeek Harness keeps each package's contract in its README; ours had none, so the contract lived
only in code headers and scattered docs.

## Validation

- Environment variables per package listed by `git grep 'process.env.'` over each package's sources.
- Claims checked in code: fallback `source.kind` in all five agents, `runTripChat` in `/api/chat`,
  memory keys, the "Source not recorded" default, `globals.css` imports.
- `node scripts/verify-docs.mjs`, `node scripts/verify-protected-files.mjs origin/main`: pass.
- `pnpm --filter @trip/orchestrator typecheck` after the comment-only change: passes.

## Notes for the next person

- Keep a README in step with its package's exports and variables; the doc rule in `AGENTS.md`
  applies.
