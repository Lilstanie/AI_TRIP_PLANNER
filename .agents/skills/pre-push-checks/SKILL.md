---
name: pre-push-checks
description: Pick the smallest set of commands that would catch a regression in the outgoing diff, instead of reflexively running the whole repository suite, in AI_TRIP_PLANNER. Use before pushing, opening or updating a pull request, or claiming that checks pass.
---

# Pre-push checks

Run relevant evidence once before a push, and report only commands you actually ran with their real
results. CI (`.github/workflows/ci.yml`) already runs `typecheck`, `lint`, `test`, `test:scripts` and `build`
for the whole repository, plus the protected-file, `verify:docs` and translation-pair checks on pull
requests. It does not run the E2E scripts, so those are local evidence only; local runs exist to catch the failure
before CI does, not to repeat CI. Which kind of test to write is the Testing approach at the top of
`AGENTS.md`. This is guidance, not a script: every behaviour change needs the narrowest evidence
that would expose its regression.

## 1. Inspect the outgoing change

```bash
git status --short --branch
git fetch origin main
git diff --name-status origin/main...HEAD
```

Include uncommitted files if you are about to commit them.

## 2. Select evidence by path

| Changed path                                                                                                 | Run                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/<pkg>/src/**`                                                                                      | Prefer an E2E path for new complex behavior; run `pnpm --filter @trip/<pkg> test` as existing regression evidence, then `pnpm turbo run typecheck --filter=...@trip/<pkg>`                                                                                                                                                                          |
| One behaviour inside a package                                                                               | If isolation is necessary, enumerate failure modes before implementation, then run the focused file: `pnpm --filter @trip/<pkg> exec vitest run tests/<file>.test.ts`                                                                                                                                                                               |
| `packages/shared/src/**`                                                                                     | `pnpm typecheck` (every package depends on it), the existing `pnpm --filter @trip/shared test` suite, and `pnpm verify:protected` — CI fails without an Agent Note                                                                                                                                                                                  |
| `apps/web/**`                                                                                                | Prefer browser E2E for complex user paths; run existing regression checks with `pnpm --filter @trip/web test`, plus web typecheck and lint                                                                                                                                                                                                          |
| A user path covered by `apps/web/tests/e2e/*.e2e.mjs`                                                        | Run it with `pnpm --filter @trip/web e2e <name>` (it starts and stops its own server; add `--prod` when the script header asks for a production server) and keep its `output/` artifact; modes and output folders are in [development.md](../../../docs/development.md#testing-approach). Add a script for a new complex path                       |
| `apps/web/drizzle/**`, `apps/web/lib/db/**`                                                                  | `pnpm --filter @trip/web db:generate` produces the migration you commit; test with and without `DATABASE_URL`, since the database is optional                                                                                                                                                                                                       |
| Route handlers, `next.config.mjs`, server/client boundaries                                                  | Add `pnpm --filter @trip/web build`. If `pnpm dev` is running, start it with `NEXT_DIST_DIR=.next-dev` so the two do not share `.next`                                                                                                                                                                                                              |
| `apps/web/app/api/**`, `apps/web/lib/account/server.ts`, or any request or response body a route returns     | Update the matching section of [docs/api.md](../../../docs/api.md) and its Chinese pair in the same PR; the API reference is the page a route change makes stale, not `docs/workspace-ui.md`                                                                                                                                                        |
| `apps/web/app/manifest.ts`, `apps/web/public/sw.js`, `apps/web/public/.well-known/**`, `apps/android-twa/**` | Run `pnpm --filter @trip/web e2e installable-app --prod` (the service worker registers only in production builds). Android signing and `assetlinks.json` steps are in [development.md](../../../docs/development.md#installable-app)                                                                                                                |
| UI a person can see                                                                                          | Also follow [ui-verification](../ui-verification/SKILL.md)                                                                                                                                                                                                                                                                                          |
| Provider adapters in `packages/tools`                                                                        | Run `pnpm --filter @trip/tools test`, which includes the gateway provider matrix and the public-boundary check. Prefer a repeatable user-path E2E with a stubbed provider; never spend real SerpApi or Google quota. If adapter isolation is necessary, enumerate failure modes before implementation. See [add-provider](../add-provider/SKILL.md) |
| `submission/stage1/**`, `docs/design/stage1/**`                                                              | Follow [stage1-submission](../stage1-submission/SKILL.md): regenerate the deck or report from source instead of committing hand edits, then the `docs/**` checks below                                                                                                                                                                              |
| `.agents/**`, `docs/**`                                                                                      | `pnpm verify:docs`, `pnpm verify:protected`, and `pnpm format:check-changed origin/main`                                                                                                                                                                                                                                                            |
| `scripts/**`, `.agents/skills/**/SKILL.md` or skill frontmatter                                              | `pnpm test:scripts` for rule changes and `pnpm verify:docs`, which runs `scripts/skill-rules.mjs` over every skill                                                                                                                                                                                                                                  |
| Root `package.json`, `pnpm-lock.yaml`, `turbo.json`, `tsconfig.base.json`                                    | The full five: `pnpm typecheck && pnpm lint && pnpm test && pnpm test:scripts && pnpm build`                                                                                                                                                                                                                                                        |

Run Prettier on the files you changed (`npx prettier --write <file>`), never on a directory: unrelated files
still hold old formatting, and reformatting them conflicts with open pull requests. CI runs
`pnpm format:check-changed` (changed files only) and `pnpm lint` now covers `packages/*` as well as `apps/web`.

The web test script sets `NODE_OPTIONS` with POSIX syntax; on Windows run it from WSL or Git Bash.

For ordinary `docs/` Markdown changes, synchronize both languages with
[translate-docs](../translate-docs/SKILL.md), record only reviewed pairs and run
`pnpm verify:pairs` (the same command). CI runs it for pull requests, so a stale pair fails the build.

After merging a branch that also touched a documentation pair, `.agents/translation-pairs.json`
usually conflicts and, even when it merges cleanly, holds hashes from neither side. Resolve the record by
taking either side, re-run `node .agents/skills/translate-docs/scripts/check-pairs.mjs --record <en path>`
for every pair both branches changed, then `pnpm verify:pairs`.

## 3. Report

List each command and its result, including test counts, in the PR's Testing section and the session
log. When a check could not run (missing key, no network), say so; do not describe it as passing.

## When to run everything

Run the full five only when the change is genuinely cross-cutting, when the user asks, or when
diagnosing a CI failure. Do not repeat a check that already passed on the same diff just because a
commit or push follows.
