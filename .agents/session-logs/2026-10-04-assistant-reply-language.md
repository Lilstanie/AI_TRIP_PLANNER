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
- Tests in `packages/orchestrator/tests/chat.test.ts`; `docs/api(.zh).md`; Agent Note
  `implemented/feature/2026-10-04-assistant-reply-language.md`.

## Why

The locale comes from the controller, not `useLocale()`: `useWorkspaceController` runs outside
`LocaleProvider`, where the context would always read `en`.

## Validation

See the pull request's Testing section for the commands run and their results.

## Notes for the next person

The rule is prompt guidance; whether a live model obeys it for a bare place name was not checked
against a real provider.
