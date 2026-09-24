---
name: pre-push-checks
description: Use before pushing, opening or updating a pull request, or claiming that checks pass in AI_TRIP_PLANNER, to pick the smallest set of commands that would catch a regression in the outgoing diff instead of reflexively running the whole repository suite.
---

# Pre-push checks

Run relevant evidence once before a push, and report only commands you actually ran with their real
results. CI (`.github/workflows/ci.yml`) already runs `typecheck`, `lint`, `test` and `build` for the
whole repository plus the protected-file and Agent Note checks; local runs exist to catch the failure
before CI does, not to repeat CI. Prefer an E2E test as the sole behavioral check for complex new
features, with a repeatable artifact. Do not write unit tests after implementation code. If isolated
testing is necessary, enumerate the failure modes before writing the code, then choose focused checks
from that list. This is guidance, not a script: every behaviour change needs the narrowest evidence
that would expose its regression.

## 1. Inspect the outgoing change

```bash
git status --short --branch
git fetch origin main
git diff --name-status origin/main...HEAD
```

Include uncommitted files if you are about to commit them.

## 2. Select evidence by path

| Changed path                                                              | Run                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/<pkg>/src/**`                                                   | Prefer an E2E path for new complex behavior; run `pnpm --filter @trip/<pkg> test` as existing regression evidence, then `pnpm turbo run typecheck --filter=...@trip/<pkg>`                                                          |
| One behaviour inside a package                                            | If isolation is necessary, enumerate failure modes before implementation, then run the focused file: `pnpm --filter @trip/<pkg> exec vitest run tests/<file>.test.ts`                                                               |
| `packages/shared/src/**`                                                  | `pnpm typecheck` (every package depends on it), the existing `pnpm --filter @trip/shared test` suite, and `pnpm verify:protected` — CI fails without an Agent Note                                                                  |
| `apps/web/**`                                                             | Prefer browser E2E for complex user paths; run existing regression checks with `pnpm --filter @trip/web test`, plus web typecheck and lint                                                                                          |
| Route handlers, `next.config.mjs`, server/client boundaries               | Add `pnpm --filter @trip/web build`. If `pnpm dev` is running, start it with `NEXT_DIST_DIR=.next-dev` so the two do not share `.next`                                                                                              |
| UI a person can see                                                       | Also follow [ui-verification](../ui-verification/SKILL.md)                                                                                                                                                                          |
| Provider adapters in `packages/tools`                                     | Prefer a repeatable user-path E2E with a stubbed provider; never spend real SerpApi or Google quota. If adapter isolation is necessary, enumerate failure modes before implementation. See [add-provider](../add-provider/SKILL.md) |
| `.agents/**`, `docs/**`                                                   | `pnpm verify:docs`, `pnpm verify:protected`, and `npx prettier --check <changed files>` (Prettier is not in CI)                                                                                                                     |
| Root `package.json`, `pnpm-lock.yaml`, `turbo.json`, `tsconfig.base.json` | The full four: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`                                                                                                                                                             |

The web test script sets `NODE_OPTIONS` with POSIX syntax; on Windows run it from WSL or Git Bash.

## 3. Report

List each command and its result, including test counts, in the PR's Testing section and the session
log. When a check could not run (missing key, no network), say so; do not describe it as passing.

## When to run everything

Run the full four only when the change is genuinely cross-cutting, when the user asks, or when
diagnosing a CI failure. Do not repeat a check that already passed on the same diff just because a
commit or push follows.
