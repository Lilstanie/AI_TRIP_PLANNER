---
date: 2026-10-23
author: Claude Code
branch: feature/team-panel-630
pr: none
area: apps/web, docs
contract-impact: none
---

# @ menu replaces the assistant chip row

## What changed

- `apps/web/components/chat/AssistantChips.tsx` and its styles are deleted. `MentionMenu.tsx` is a
  listbox of the six assistants with icons and current names; `Composer.tsx` opens it when `@` starts a
  word, filters by the text after it, and drives it from the keyboard (`aria-activedescendant`, the
  textarea keeps focus).
- Backspace right after a whole `@name` selects that token; the second Backspace deletes the selection
  natively. `mentions.ts` gains `activeMention`, `matchesMention` and `mentionBefore`; the value stays
  plain text and `resolveMentions` is unchanged. IME composition disables both.
- New `mention-menu.e2e.mjs` with its failure inventory (written first), at 1440 and 390 in English
  and Chinese. `phone-mention-chips-row` is deleted; `specialist-mention`, `assistant-rename`,
  `assistants-demo` and `phone-sheet-targets` no longer select chips.
- `docs/workspace-ui.md` and its Chinese pair describe the menu. The unused `Mention {name}` string is
  removed.

## Why

#630 (spec #629): the chip row took space and a mention could only be removed letter by letter. The
Agent Note for the spec is written with #631.

## Validation

- Red first: `mention-menu` failed before the code. After it, 100% of its checks pass.
- `pnpm --filter @trip/web e2e mention-menu` passes; screenshots and `result.json` are in
  `output/playwright/mention-menu/after/`.
- Web typecheck, lint, unit tests (642), `check-ui-copy`, `verify:e2e-selectors` and
  `verify:e2e-artifacts` pass.

## Known limits

IME behaviour is simulated with CDP composition events and a synthetic composing keydown, not a real
input method.
