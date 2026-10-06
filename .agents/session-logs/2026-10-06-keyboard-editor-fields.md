---
date: 2026-10-06
author: Claude Code
branch: fix/187-keyboard-hides-fields
pr: none
area: apps/web, docs
contract-impact: none
---

# Phone keyboard keeps trip-fact and stop-editor fields and Save in view (#187)

## What changed

- `apps/web/components/workspace/usePhoneKeyboard.ts`: typing now also counts in `.fact-popover`
  and `.item-editor`; sets `--phone-keyboard-inset`; reveals the focused field (or the whole stop
  editor when it fits) in its nearest scroll container instead of only `.question__body`.
- `apps/web/app/styles/phone-keyboard.css`: while typing, fact sheets rest on the keyboard and fit
  the visible height, dropping the safe-area padding the keyboard covers.
- `apps/web/tests/e2e/phone-state.e2e.mjs`: Where, Budget and last-stop editors are checked with a
  shrunken fake `visualViewport` (field and Save inside it and hit-testable, tab bar hidden, page
  not scrolled); screenshots `*-editor-keyboard.png`.
- Docs: `docs/workspace-ui.md` + `.zh.md`, the phone-shell Agent Note's Keyboard fact and the
  ui-verification skill checklist.

## Why

Fact sheets are `position: fixed` on the layout viewport, which the keyboard does not shrink, so
they need an explicit bottom inset. `interactive-widget=resizes-content` was not used: it would
change composer behaviour on Android that #180 already tuned.

## Validation

- New checks failed first: Where field 586–630 and Save 788–827 at a 534 px viewport, tab bar
  visible (matches the issue).
- `BASE_URL=http://localhost:3103 node apps/web/tests/e2e/phone-state.e2e.mjs` (mock dev server):
  100/100 ok at 390×844 and 360×800.
- `pnpm --filter @trip/web typecheck`, `pnpm --filter @trip/web lint`: pass.

## Notes for the next person

- Real-device confirmation for #182 is still needed.
- Running the E2E with `cwd` inside `apps/web` against `next dev` writes screenshots into the
  watched tree and can trigger a reload mid-run; run it from the repository root.
