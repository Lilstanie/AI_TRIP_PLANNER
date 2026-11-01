# Agent Note: Narrow CLI acceptance for app source changes

Status: implemented
Owner: C (HeadmasterEggy)

## Problem

Every pull request spent about seven minutes in CI. Two causes sat in
`apps/web/tests/cli-e2e/select.mjs`. `real-clerk-route-inventory.e2e.mjs` was never classified, so
every plan reported inventory drift and ran the full suite, including documentation-only changes.
App source also fell under shared-or-unknown, so a UI fix ran all fifteen scripts. Only
`local-cli-collections.e2e.mjs` builds the real app and drives its smoke journey; the rest test the
runner, cleanup, report and selection tools against fixtures. The longest shard (legacy runner,
cleanup, repeat, report) took about 6.5 minutes on PRs #874-#879.

## Decision

`real-clerk-route-inventory.e2e.mjs` joins the reviewed infrastructure inventory. An `app-source`
rule selects only `local-cli-collections.e2e.mjs` for `apps/web/{app,components,lib,public}/`,
`apps/web/tests/{app,components,lib,fixtures}/`, `packages/*/{src,tests}/` and top-level
`apps/web/tests/e2e/*.e2e.mjs` or `*.md` other than `agent-lab-*` and `real-clerk-*`, whose
journeys the runner scripts execute. Runner files, `support/`, package and build configuration,
CI files and unknown paths still select the full suite; pushes to `main` still run everything.

This narrows the shared-or-unknown default of the
[CLI acceptance CI note](2026-10-12-cli-acceptance-ci.md); its planning, worker and aggregate
decisions stay in force.

## Alternatives considered

- Change the workflow (concurrency cancel, browser cache, parallel `check`): touches protected
  `.github` files and does not remove the redundant runner self-tests.
- Skip CLI acceptance for app source entirely: loses the only real-app production build and smoke
  journey in the CLI suite.

## Consequences

- App PRs need one browser shard (~3.5 minutes) and the `check` job (~3 minutes) instead of three
  shards; documentation-only PRs skip workers again.
- A regression in the runner caused by app code is caught on the `main` push, not before merge.
- New runner-facing paths must be added to the full-coverage side; anything unmatched still runs full.
