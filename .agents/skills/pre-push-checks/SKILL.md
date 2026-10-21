---
name: pre-push-checks
description: Pick the smallest set of commands that would catch a regression in the outgoing diff, instead of reflexively running the whole repository suite, in AI_TRIP_PLANNER. Use before pushing, opening or updating a pull request, or claiming that checks pass.
---

# Pre-push checks

Run relevant evidence once before a push, and report only commands you actually ran with their real
results. CI (`.github/workflows/ci.yml`) already runs `typecheck`, `lint`, `test`, `test:scripts` and `build`
for the whole repository, plus the protected-file, `verify:docs` and translation-pair checks on pull
requests. CLI acceptance uses a builtin-only plan, up to three isolated workers and a stable aggregate;
[development.md](../../../docs/development.md#cli-acceptance-in-ci) owns selection, fallback, skip and
artifact behavior. Scripts remain serial within each worker, including registered fixture browser
journeys, with evidence retained on failure. Other raw browser scripts remain
local evidence; select the relevant one rather than repeating unrelated acceptance runs. It also runs `pnpm verify:e2e-artifacts`, which fails when an E2E script writes no artifact. It does run `pnpm verify:e2e-selectors`, which fails when an E2E script
selects a class no component renders, so removing or renaming a class means updating the scripts that use it. A
script that fails may already fail on `main`: read [e2e-known-failures](../../../docs/e2e-known-failures.md)
before calling a failure yours or not, and update it when you find or fix one. Which kind of test to write is the Testing approach at the top of
`AGENTS.md`. This is guidance, not a script: every behaviour change needs the narrowest evidence
that would expose its regression.

When the reliability of an E2E check is in doubt, follow
[e2e-maintenance](../e2e-maintenance/SKILL.md) for equivalent reproductions and failure controls.

## 1. Inspect the outgoing change

```bash
git status --short --branch
git fetch origin main
git diff --name-status origin/main...HEAD
```

Include uncommitted files if you are about to commit them.

For task-specific comment restrictions and the originating spec, follow
[review-trip-planner](../review-trip-planner/SKILL.md) before claiming review is complete. Its scoped
comment checker also runs through the independent Comment policy workflow on PRs and main pushes;
see its reference for the clean-head adapter and exact exception list. When changing that adapter
or workflow, run `node apps/web/tests/ci/comment-policy.e2e.mjs` and actionlint locally.

## 2. Select evidence by path

| Changed path                                                                                             | Run                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/<pkg>/src/**`                                                                                  | Prefer an E2E path for new complex behavior; run `pnpm --filter @trip/<pkg> test` as existing regression evidence, then `pnpm turbo run typecheck --filter=...@trip/<pkg>`                                                                                                                                                                          |
| One behaviour inside a package                                                                           | If isolation is necessary, enumerate failure modes before implementation, then run the focused file: `pnpm --filter @trip/<pkg> exec vitest run tests/<file>.test.ts`                                                                                                                                                                               |
| `packages/shared/src/**`                                                                                 | `pnpm typecheck` (every package depends on it), the existing `pnpm --filter @trip/shared test` suite, and `pnpm verify:protected` — CI fails without an Agent Note                                                                                                                                                                                  |
| `apps/web/**`                                                                                            | Prefer browser E2E for complex user paths; run existing regression checks with `pnpm --filter @trip/web test`, plus web typecheck and lint                                                                                                                                                                                                          |
| A user path covered by `apps/web/tests/e2e/*.e2e.mjs`                                                    | Run it with `pnpm --filter @trip/web e2e <name>` (it starts and stops its own server; add `--prod` when the script header asks for a production server) and keep its `output/` artifact; modes and output folders are in [development.md](../../../docs/development.md#testing-approach). Add a script for a new complex path                       |
| `apps/web/drizzle/**`, `apps/web/lib/db/**`                                                              | `pnpm --filter @trip/web db:generate` produces the migration you commit; test with and without `DATABASE_URL`, since the database is optional                                                                                                                                                                                                       |
| Route handlers, `next.config.mjs`, server/client boundaries                                              | Add `pnpm --filter @trip/web build`. If `pnpm dev` is running, start it with `NEXT_DIST_DIR=.next-dev` so the two do not share `.next`                                                                                                                                                                                                              |
| `apps/web/app/api/**`, `apps/web/lib/account/server.ts`, or any request or response body a route returns | Update the matching section of [docs/api.md](../../../docs/api.md) and its Chinese pair in the same PR; the API reference is the page a route change makes stale, not `docs/workspace-ui.md`                                                                                                                                                        |
| `apps/web/app/manifest.ts`, `apps/web/public/sw.js`                                                      | Run `pnpm --filter @trip/web e2e installable-app --prod` (the service worker registers only in production builds).                                                                                                                                                                                                                                  |
| UI a person can see                                                                                      | Also follow [ui-verification](../ui-verification/SKILL.md)                                                                                                                                                                                                                                                                                          |
| Provider adapters in `packages/tools`                                                                    | Run `pnpm --filter @trip/tools test`, which includes the gateway provider matrix and the public-boundary check. Prefer a repeatable user-path E2E with a stubbed provider; never spend real SerpApi or Google quota. If adapter isolation is necessary, enumerate failure modes before implementation. See [add-provider](../add-provider/SKILL.md) |
| `submission/stage1/**`, `docs/design/stage1/**`                                                          | The package is submitted. Regenerate the deck or report from source as [its README](../../../submission/stage1/README.md) describes instead of committing hand edits, then the `docs/**` checks below                                                                                                                                               |
| `.agents/**`, `docs/**`                                                                                  | `pnpm verify:docs`, `pnpm verify:protected`, and `pnpm format:check-changed origin/main`                                                                                                                                                                                                                                                            |
| `scripts/**`, `.agents/skills/**/SKILL.md` or skill frontmatter                                          | `pnpm test:scripts` for executable rule changes; prose-only changes need semantic inspection and focused existing guards, without new tests or broad application suites. Run `pnpm verify:docs`, which runs `scripts/skill-rules.mjs` over every skill                                                                                              |
| Root `package.json`, `pnpm-lock.yaml`, `turbo.json`, `tsconfig.base.json`                                | The full five, with the generated-type writer first: `pnpm build && pnpm typecheck && pnpm lint && pnpm test && pnpm test:scripts`                                                                                                                                                                                                                  |

For `apps/web/tests/cli-e2e/` planning, runner or CI integration changes, run the builtin subprocess
acceptance commands before considering browser setup:

```bash
node apps/web/tests/cli-e2e/selection.e2e.mjs
node apps/web/tests/cli-e2e/runner-plan.e2e.mjs
node apps/web/tests/cli-e2e/ci-integration.e2e.mjs
```

Validate workflow syntax with actionlint when changing CI. Local command evidence does not prove
GitHub matrix scheduling, uploads or Ubuntu/Node 22 behavior. Inspect the integration PR's final-SHA
plan, every planned worker, aggregate and artifacts before reporting current CI success. Dependent
PRs require combined integration evidence before merge; a later full main run is SHA-bound post-merge
evidence, not a pre-merge guarantee. Preserve the no-argument full runner for local use.

Run Prettier on the files you changed (`pnpm exec prettier --write <file>`), never on a directory: unrelated files
still hold old formatting, and reformatting them conflicts with open pull requests. CI runs
`pnpm format:check-changed` (changed files only) and `pnpm lint` now covers `packages/*` as well as `apps/web`.

The web test script sets `NODE_OPTIONS=--no-experimental-webstorage` with POSIX syntax; retain that
flag when using a focused direct Vitest invocation in `@trip/web`:

```bash
NODE_OPTIONS=--no-experimental-webstorage pnpm --filter @trip/web exec vitest run tests/<file>.test.ts
```

On Windows use WSL or Git Bash. Prefer package scripts so their runtime flags remain in effect.

### Generated Next types and check ordering

`apps/web/tsconfig.json` includes generated Next type directories. When a build and web typecheck
use the same generated output, let the build finish successfully before starting typecheck:

```bash
pnpm --filter @trip/web build
pnpm --filter @trip/web typecheck
```

For repository-wide checks sharing that output, finish `pnpm build` before `pnpm typecheck` too.
Do not run the writer and reader concurrently in one working directory; build may replace types
while TypeScript reads them. A running dev server uses `NEXT_DIST_DIR=.next-dev` to avoid the default
build directory. Raw E2E runs now allocate unique build directories and owned temporary TypeScript
configs; preserve that isolation and any explicit `NEXT_TSCONFIG_PATH` override. Do not hand-edit
the generated Next environment declaration (next-env.d.ts) or erase another run's generated files to resolve a race. Re-run the affected check
after the writer completes, retaining the original failure evidence.

For ordinary `docs/` Markdown changes, synchronize both languages with
[translate-docs](../translate-docs/SKILL.md), review each pair you changed and run
`pnpm verify:pairs` (the same command). CI runs it for pull requests, so an English change without its
Chinese counterpart fails the build.

## 3. Validate the final tree

Evidence belongs to the code and test tree that ran, including uncommitted inputs, not just a branch
name. Record the revision, tree ID (`git rev-parse HEAD^{tree}` for a clean committed tree), exact
commands, runtime/browser versions, non-sensitive environment and fixture assumptions, assertion/skip
counts, exit codes, summaries and artifacts. Preserve earlier failures, timeouts and partial evidence;
a later pass does not erase them. Apply the coverage ownership map in
[find-simplifications](../find-simplifications/SKILL.md#simplify-tests-without-losing-coverage)
when tests or their shared setup change.

After a merge, rebase, conflict resolution or fix, inspect the final diff and rerun affected checks.
Earlier evidence may survive a tree-identical rebase only with an explicit basis: record the tested
and final revisions, compare their full tree IDs, confirm a clean working tree and equivalent tools,
configuration, dependencies and environment. Equal diffs or unchanged branch names are insufficient.
If the trees differ or the inputs cannot be established, select and rerun the affected checks; do not
carry the old pass forward. Explain any still-applicable evidence and its limits in the handoff.

## 4. Report

List each command and its result, including test counts, in the PR's Evidence section and the session
log. When a check could not run (missing key, no network), say so; do not describe it as passing.

Once the pull request body quotes that evidence, run `pnpm clean:output` (AGENTS.md delivery step 5).
It deletes every Git-ignored scratch directory that
[development](../../../docs/development.md#testing-approach) lists, so anything not quoted or
attached is gone; `pnpm clean:output --dry-run` lists sizes first. CI evidence is uploaded separately and is
not affected.

## 5. After the merge

Delete the pull request's remote branch once it is merged or closed: GitHub keeps a Restore branch
button on the pull request, so nothing is lost. Before deleting any other branch, confirm that no open
pull request uses it and that `git cherry origin/main origin/<branch>` lists no unmerged commit;
otherwise leave it and ask its owner. Delete the local checkout of the branch as well.

## When to run everything

Run the full five only when the change is genuinely cross-cutting, when the user asks, or when
diagnosing a CI failure. Do not repeat a check that already passed on the same diff just because a
commit or push follows; apply the final-tree rule above before reusing evidence after integration.
