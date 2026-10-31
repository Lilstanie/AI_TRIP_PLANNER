---
date: 2026-10-31
author: Claude Code (for Joey)
branch: feature/TP-206-next-intl-native-zh
pr: pending
area: apps/web, docs, .agents
contract-impact: none
---

# Move interface copy to next-intl and rewrite the Chinese natively (TP-206)

## What changed

- `apps/web/lib/i18n/messages/` holds the en/zh catalogs (workspace and shell); `locale.ts` and
  `LocaleProvider.tsx` translate through next-intl; `workspace-messages.ts` and `phone-messages.ts` are gone.
- About 130 call sites use message ids; singular/plural pairs became ICU plurals and concatenated
  fragments (ratings, route status, flight legs, stop numbers) became single messages.
- Chinese values rewritten as native copy, keeping established terms; zh quick prompts still parse offline.
- Existing unit tests and E2E Chinese selectors updated; no new tests (Joey's request).
- Docs: `docs/workspace-ui.md` pair, `docs/e2e-known-failures.md` pair, better-writing skill, notes.

## Why

See [next-intl message catalogs](../notes/implemented/architecture/2026-10-31-next-intl-message-catalogs.md).

## Validation

Results are in the PR's Evidence section; before/after Chinese screenshots compare `main` with this branch.

## Notes for the next person

- Server-side Chinese in `packages/orchestrator` (cost-line, progress-copy, brief-intake) and the
  trajectory locale dictionary were not rewritten.
- `ui-language` E2E fails on `main` too; listed in `docs/e2e-known-failures.md`.
