---
date: 2026-10-04
author: Claude Code (for Joey)
branch: feature/assistant-reply-language
pr: none
area: packages/shared, packages/orchestrator, apps/web, docs
contract-impact: packages/shared
---

# Assistant falls back to the interface language when a message shows none (#149)

## What changed

- `packages/shared/src/chat.ts`: `InterfaceLanguage` (`en` | `zh`) and optional `ChatRequest.interfaceLanguage`.
- `packages/orchestrator/src/chat.ts`: `replyLanguageRule` appends one `Reply language:` rule after the
  communication-style text when the field is sent; nothing otherwise.
- `apps/web/components/workspace/useWorkspaceTransport.ts` sends the controller's interface locale
  with every chat request.
- E2E `apps/web/tests/e2e/reply-language.e2e.mjs` (request body and API boundary); tests in
  `packages/orchestrator/tests/chat.test.ts`; `docs/api(.zh).md`; Agent Note
  `implemented/feature/2026-10-04-assistant-reply-language.md`.

## Why

The locale comes from the controller, not `useLocale()`: `useWorkspaceController` runs outside
`LocaleProvider`, where the context would always read `en`.

## Validation

- `node apps/web/tests/e2e/reply-language.e2e.mjs` against `pnpm --filter @trip/web dev`: 6/6 ok;
  artifact `output/playwright/reply-language/` (report.json, screenshot).
- `pnpm typecheck` 6/6 tasks, `pnpm lint` exit 0; tests: shared 49, orchestrator 227, web 450 passed.
- The new orchestrator test fails when the rule is not appended (checked by disabling it).
- `pnpm verify:docs`, `verify:pairs`, `verify:protected` pass.

## Notes for the next person

The rule is prompt guidance; whether a live model obeys it for a bare place name was not checked
against a real provider. Without a key the offline path still replies in fixed English.
