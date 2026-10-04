---
date: 2026-10-04
author: Claude Code (for Joey, member C)
branch: feature/ui-language-browser-default
pr: 154
area: apps/web, docs
contract-impact: none
---

# Interface language follows the browser and t() only takes translated keys

## What changed

- `apps/web/lib/account/settings.ts`: `language` is optional (`en` | `zh`), no longer defaulted to `en`.
- `apps/web/components/account/LocaleProvider.tsx`: `useInterfaceLocale()` resolves the saved choice
  or the browser language after hydration, and sets `<html lang>` (`zh-CN` / `en-AU`).
- `apps/web/lib/i18n/locale.ts`: `t()` is typed to dictionary keys; added the 21 entries the
  typecheck then found missing (account menu, sync status, budget tiers, "65+", Manage, Export).
  `Budget|tier` keeps the cheapest preset from reading as 预算.
- `apps/web/tests/e2e/ui-language.e2e.mjs`: zh-CN and en-AU browser defaults, and a saved choice
  beating the browser.
- Updated the [language note](../notes/implemented/feature/2026-10-04-interface-language-only.md)
  and the `docs/workspace-ui` pair.

## Why

Spec #145 and ticket #146 ask for `en` | `zh`, a browser default and a typed `t()`. The first PR
defaulted to English and passed untranslated strings through `t()` silently.

## Validation

- `pnpm --filter @trip/web exec tsc --noEmit -p .`: passed (failed on 21 untranslated keys before the entries were added).
- `pnpm --filter @trip/web lint`: no warnings or errors.
- `pnpm --filter @trip/web test`: 450 passed.
- `DATA_MODE=mock` dev server + `ui-language.e2e.mjs`: 15 checks passed, screenshots in
  `output/playwright/ui-language/`.

## Notes for the next person

The rest of #148 is still open: example trip chips ("4 days"), chat, timeline and most of the
settings dialog remain English in Chinese mode.
