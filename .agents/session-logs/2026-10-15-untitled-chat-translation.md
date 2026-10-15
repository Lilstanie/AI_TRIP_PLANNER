---
date: 2026-10-15
author: Claude Haiku 5.5 (scheduled triage run)
branch: fix/untitled-chat-translation
pr: none
area: apps/web
contract-impact: none
---

# Translate the default title of untitled chat rows (#353)

## What changed

- `apps/web/components/workspace/ChatsPanel.tsx`: chat rows show `t("New chat")` when the stored title is the English default, both as text and as `title`.
- `apps/web/tests/e2e/phone-mine.e2e.mjs`: seeds an untitled chat and checks its row reads `新聊天` after switching to Chinese.

## Why

The stored title stays `"New chat"` so existing catalogs and tests keep their meaning. Translation happens at render time only.

## Validation

- `pnpm exec prettier --check` on both changed files: pass.
- `pnpm --filter @trip/web typecheck`: pass.
- `pnpm --filter @trip/web lint`: pass.
- `pnpm --filter @trip/web test -- tests/components/workspace`: 3 files, 45 tests pass.
- `pnpm --filter @trip/web e2e phone-mine` (dev and `--prod`): fails at `waitForSelector(".phone-mine")` after 30s. The unmodified main branch fails identically, so the failure predates this change. Likely cause: the Clerk sign-in gate in this environment. Not verified.

## Notes for the next person

- The new E2E check has not run green. Re-run `phone-mine` where a signed-out workspace renders.
- A user-renamed chat titled exactly "New chat" also renders translated in Chinese. Accepted as a minor edge.
