---
date: 2026-10-22
author: Claude (for Joey)
branch: feature/rename-specialists
pr: none
area: packages/shared, apps/web, docs
contract-impact: packages/shared
---

# Rename assistants in the assistant settings

## What changed

- `packages/shared/src/chat.ts`: `AssistantNames`, `MAX_ASSISTANT_NAME_LENGTH` and `AssistantSettings.names`.
- `apps/web`: a name field per assistant in Settings → Personalization, `assistant-names.ts` (display name, uniqueness, hook), and the chips, reply bubbles, team conversation and Subagent rows show the current name; `resolveMentions` also resolves custom names.
- `apps/web/tests/e2e/assistant-rename.e2e.mjs` and its failure inventory.
- Agent Note updated; `GLOSSARY.md` (Specialist name); `docs/workspace-ui.md`, `docs/api.md` and their `.zh.md` pairs.

## Why

Spec #561 ticket #566. Joey approved the `packages/shared/src/chat.ts` change on 2026-10-22.

## Validation

See the pull request body.

## Notes for the next person

Status lines that the model builds from role names (for example "Working with …") still use the role name, not the custom name.
