---
date: 2026-10-10
author: Codex
branch: refactor/ponytail-simplification
pr: 291
area: apps/web, apps/android-twa, packages/agents, packages/services, packages/tools, docs
contract-impact: api
---

# Reduce unused code and duplicated test setup

## What changed

- Implemented #280–#289 and reconciled coverage in #290; tracked code falls from 89,208 to 88,465 physical lines, including all new helpers and regressions.
- Removed unused UI/service/model/gateway surfaces, obsolete styles and Android identity overrides; retained account, storage, provider and migration boundaries.
- Shared grounded place-name handling and trip-test setup; preserved every unique trip assertion and the dedicated five-fault matrix.
- Consolidated place error responses; failure-first regressions correct details/photo unavailable errors from 404 to the required 503.
- Updated paired README, API, development and class diagrams, routing/simplification decisions and known E2E failures.

## Why

The [approved specification](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/279) removes maintained obligations without replacing the test framework. The [decision and coverage map](../notes/implemented/simplification/2026-10-10-repository-surface-reduction.md) records retained owners.

## Validation

All commands used pinned pnpm 9.15 with an isolated Corepack PATH; provider/model and Clerk keys were blank for mock browser runs.

- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:scripts`, `pnpm build`: pass; 101 test files / 1,163 tests and 35 script checks.
- `pnpm verify:docs`, `pnpm verify:protected`, `pnpm verify:pairs`: pass; 25 reviewed pairs.
- `pnpm verify:e2e-selectors`, `pnpm format:check-changed origin/main`, `git diff --check`: pass after annotating the retained absence assertion.
- `pnpm --filter @trip/web e2e drawer-walkthrough timeline phone-state installable-app auto-save-places plan-revision check-entry-point --prod`: drawer, auto-save, revision and check-entry pass, 194 / 36 / 22 / 33 checks (drawer records two known exceptions); other outcomes below.
- `pnpm --filter @trip/web e2e installable-app --prod`: 24/24 pass after installing full Chromium; initial missing-binary crash was a prerequisite failure.
- Combined production `agent-lab-release agent-lab-failures`: 159 / 129 checks pass; frozen-source rerun and unchanged release baseline pass after an earlier storage-only failure, without weakening assertions.
- `MOCK_GOOGLE_MAPS=unavailable` map-fallback: pass; OSM provider HTTP with local upstream stubs: 18 checks pass, no paid provider traffic.
- Combined `timeline` and `phone-state --prod`: 99/100 and 98/100; unchanged `42fded7` reproduces the same fare-fixture 404 assertion and two Map-reload failures. See [known failures](../../docs/e2e-known-failures.md).
- Parallel Standards and Spec review of `42fded7...9b17a5f`: zero implementation findings on each axis; final selector annotation is a mechanical guard fix.

## Notes for the next person

Android compile attempted with ARM JDK 21 but blocked before Java compilation by missing Android SDK. No physical-device, live-provider or paid-model validation is claimed. New implementer worktrees are cleaned after evidence is copied; the integration worktree and unrelated primary-checkout work remain. Detailed run logs, baseline comparisons and artifacts are indexed in `/Users/joey/Downloads/AI-Trip-Planner-Ponytail-Tickets-2026-10-10/implementation/verification-index.json`.
