---
date: 2026-09-22
author: Claude Code, with @HeadmasterEggy
branch: docs/agent-notes-and-skills
pr: none
area: .agents, docs, scripts, .github/workflows
contract-impact: none
---

# Agent Notes by lifecycle and class, workflow skills, and docs limited to current state

## What changed

- Notes follow DeepSeek Harness: `{proposed,implemented,rejected,archived}/{class}/`.
  `accepted/` became `implemented/`; `rejected/` and `archived/` are frozen.
- `scripts/verify-docs.mjs` (`pnpm verify:docs`, CI) checks note paths, status lines and sections,
  skill frontmatter, and Markdown links outside frozen history. `.agents/notes/AGENTS.md` (with a
  `CLAUDE.md` link) holds local rules.
- `AGENTS.md`: documentation, notes and skills change in the same PR as the facts they describe.
- Fixed three links in `.agents/session-logs/README.md` broken by the earlier move out of `docs/`.
- `docs/archive/` moved unchanged to `.agents/archive/`; `docs/AGENTS.md` (with a `CLAUDE.md` link)
  says which content belongs where. `api.md` gains `GET /api/data-mode`, the `x-trip-data-mode`
  header and current storage; `roadmap.md` drops HITL and reflects what has shipped.
- Eleven notes backfilled from session logs and commits, each checked against current code.
- Skills: `pre-push-checks`, `code-review`, `ui-verification`, `add-provider`, `agent-notes`, with a
  process note recording the evidence each one comes from.

## Why

Decisions lived only in session logs, and every session relearned the same workflows. Several logged
facts had drifted: hotel estimates are now AUD 135/225/390/630, snapshots are version 3, and the
SerpApi counter uses the durable store when configured. Notes state the current code.

## Validation

- `node scripts/verify-docs.mjs`: passes. Throwaway bad notes and skills (unknown class, missing
  sections, `## Proposal` in implemented, broken link, archived note without `Archived:`, skill
  without `SKILL.md` or with the wrong `name`) failed with each error listed.
- `node scripts/verify-protected-files.mjs origin/main`: passes.
- Commands the skills recommend were run once: focused tools and web Vitest files, and the turbo
  dependents filter (`--filter=...@trip/tools` selects agents, orchestrator, tools, web).
- Relative links in notes, skills and rules: 0 broken. Prettier: clean.

## Notes for the next person

- Owners on notes follow the inferred A–E mapping.
- `docs/todo-product-closure.md` is still a dated plan in `docs/`; split it in a separate PR.
- Some alternatives in backfilled notes are inferred from constraints the logs state.
