---
date: 2026-10-30
author: Codex with Weihao Wang
branch: detached at 700c13c8
pr: none
area: apps/web tests, docs
contract-impact: none
---

# TP-62: enumerate runtime API exports for authentication acceptance

## What changed

- `api-route-methods.mjs` discovers HTTP exports through TypeScript, including constants,
  aliases and re-exports; it excludes type-only exports, source-text examples and private folders.
- `real-clerk-auth.e2e.mjs` uses that inventory and exposes credential-free `--list-routes`.
  Explicit HEAD checks retain uncached 401 requirements without demanding a response body.
- A CLI fixture covers discovery and refusal predicates; the failure inventory and both
  development documentation languages describe the boundary.

## Validation

- Node 24.20.0, pnpm 9.15.0, TypeScript 5.9.3; base `700c13c8222905b47bb883085096f75e34029d61`.
- Retained red cases: old scanner misses aliases/constants/re-exports and matches example text;
  type-only star exports and HEAD body semantics each failed before their respective fixes.
- `LABEL=final node apps/web/tests/cli-e2e/real-clerk-route-inventory.e2e.mjs`: four named checks passed.
- `node apps/web/tests/e2e/real-clerk-auth.e2e.mjs --list-routes`: 15 routes, 18 explicit methods.
- `pnpm test`: 126 files / 1,440 tests passed across six packages (one package cached).
- `pnpm test:scripts`: 70 passed, none skipped. Web typecheck and lint passed; existing Hook warnings remain.
- Docs links, 31 translation pairs, protected files, E2E selectors/artifacts and explicit Prettier passed.
- Early attempts retained: missing local dependency, wrong nested pnpm path, and loopback-listen
  sandbox denial in `services/tests/durable.test.ts`; corrected environment passed.

## Notes for the next person

No application behavior or auth policy changed. CLI checks do not establish real Clerk/Neon,
expired-session, deployed-site or quota acceptance. #441 remains open and TP-62 stays In Progress.
No credentials, cloud migration, remote push or PR merge occurred. TP-45 PR #773 remains a draft;
its documentation patch merges cleanly with this main revision. Code-owner review is now required.
Evidence remains in this checkout's `output/`; no cleanup before publication.
