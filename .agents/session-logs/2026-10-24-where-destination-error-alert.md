---
date: 2026-10-24
author: Claude Haiku 5.5 (scheduled triage run)
branch: fix/where-destination-error-alert
pr: none
area: apps/web
contract-impact: none
---

# Announce the Where sheet validation errors

## What changed

- `apps/web/components/preferences/WhereFields.tsx`: the destination error (`#fact-destination-error`) and the "Departing from" error (`#fact-origin-error`) now carry `role="alert"`, as the Budget and other fact sheets do.
- `apps/web/tests/e2e/fact-errors.e2e.mjs`: added a Where step that saves a blank destination and checks the alert role and the `aria-describedby` / `aria-invalid` link.

## Why

Issue #655: the Where error was shown but not announced. Focus stays on the input, so screen readers did not hear that Save failed.

## Validation

- Before the fix (component stashed, same E2E): `pnpm --filter @trip/web e2e fact-errors` exit 1, 7/8 checks passed. The failing check was "empty destination validation is an alert".
- After the fix: same command exit 0, 8/8 checks passed, no page errors.
- `pnpm --filter @trip/web typecheck`: exit 0.
- `pnpm --filter @trip/web lint`: exit 0.
- Not run: the full web test suite, and a real screen reader.

## Notes for the next person

- The "Departing from" error was also changed, because the issue asked for it. The E2E does not assert that error.
