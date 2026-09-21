---
date: 2026-09-22
author: Claude Code, with @HeadmasterEggy
branch: docs/split-product-closure-todo
pr: none
area: docs, .agents
contract-impact: none
---

# Split the product closure TODO into notes, the roadmap and the archive

## What changed

- `docs/todo-product-closure.md` moved unchanged to `.agents/archive/`; `docs/` no longer holds a
  dated plan.
- Two implemented notes for decisions that had no other record: the Redis REST durable store and the
  14-day weather forecast boundary.
- `AGENTS.md` points sessions at `docs/roadmap.md` for product status; the `source.kind` note links
  the archived TODO.

## Why

Each section was checked against the code. Degraded visibility, provenance, SerpApi and AUD already
had notes; the UI reference policy is in `docs/design/ui-guidelines.md`; directory rules are in
`docs/development.md`; later providers are on the roadmap. The HITL card work, UI implementation
order and PR merge records are history. The only open item, live end-to-end verification, is already
on the roadmap.

## Validation

- `node scripts/verify-docs.mjs` and `node scripts/verify-protected-files.mjs origin/main`: pass.
- Weather horizons, provider limits and storage behaviour read from `weather.ts`, `durable/index.ts`
  and `serpapi.ts`.

## Notes for the next person

- The archived TODO recorded that stacked PRs (#32–#36) only reached `main` through #37; the
  merge-into-main-only rule and note now cover it.
