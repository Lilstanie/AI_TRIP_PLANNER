# On-trip saved-day fallback

- Area: `apps/web`, `docs`; contract impact: none.
- Reproduced a stale saved Day 5 preference overriding Today in a three-day trip. The integration-worktree browser run failed before the fix; after adding the bounds check it passed.
- Added an E2E regression for out-of-range saved days and reset the fake clock so later pre-trip assertions retain their expected date.
- Updated the English and Chinese workspace UI docs to document valid saved-day restoration and expired/out-of-range fallbacks.
- Verification: `CHANNEL=chrome pnpm --filter @trip/web e2e on-trip-day` passed; report `output/e2e/runner/2026-10-18T21-05-54-466Z.json`.
- An initial PR-worktree E2E attempt exposed a fake-clock leak in the test; the out-of-range assertion passed, then subsequent pre-trip checks failed. After restoring the clock, the full E2E run passed.
- Verification: `pnpm --filter @trip/web test` (57 files, 632 tests), `pnpm --filter @trip/web typecheck`, `pnpm --filter @trip/web lint`, `pnpm verify:docs`, `pnpm verify:protected`, `pnpm verify:pairs`, `pnpm verify:e2e-artifacts`, `pnpm verify:e2e-selectors`, focused Prettier check, and `git diff --check` passed.
- Test output includes existing jsdom canvas-not-implemented warnings; the test command exited successfully.
- Related open PR #442 attempts to revert the broader feature batch and fails protected-file validation; it remains untouched. No PR was merged.
