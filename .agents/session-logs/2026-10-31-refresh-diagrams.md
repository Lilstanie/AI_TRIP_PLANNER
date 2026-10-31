---
date: 2026-10-31
author: Claude Code (for Joey)
branch: docs/TP-203-refresh-diagrams
pr: none
area: docs
contract-impact: none
---

# Bring the architecture diagrams and READMEs in line with main at 29c7bd4

## What changed

- Archify specs re-authored and re-rendered with Archify 3.2 (HTML, delivery receipts and
  visual-check evidence regenerated): `tool-gateway` (every live adapter and fallback),
  `chat-stream` (account memory, final frame before persistence), `chat-langchain` (@-mention
  handoff, unchanged-brief shortcut), `agent-collaboration` (@-mention reruns, specialist rules),
  `storage-sync` (Postgres account memory), `map-exploration` (rejected Google key, current source
  lines), `agent-trust-boundaries`, `project-overview` (Clerk, account DB, jsonStore, web map
  provider) and member C `c-activity` (one-time stay search failure, #816/#829).
- Mermaid: `docs/architecture.md` overview and member C activity diagram, both languages.
- `docs/architecture-diagrams.md` descriptions; `README.md` / `README.zh.md` flow, demo note
  (`pnpm dev`, #845), `GEOAPIFY_API_KEY`, where remembered preferences live.

## Why

Archify 3.2 requires `meta.output` and is stricter than 3.1 (desktop readability, corridors), so the
touched specs were narrowed to fit the 1240px reader budget instead of dropping content.

## Validation

- `archify finalize --quality showcase` (with `--repo-root .` for code-backed specs) and
  `archify visual-check --require-provenance`: pass for all nine diagrams; screenshots inspected.
- `pnpm verify:docs`, `pnpm verify:pairs`, `pnpm verify:protected`: pass.
- `npx prettier --check` on changed Markdown and JSON: pass.

## Notes for the next person

- Untouched `contracts-flow` (desktop readability) and `plan-lifecycle` (schema) fail Archify 3.2
  validation and need the same kind of fixes before their next re-render.
- Stage 1 class and member A/B/D/E models are conceptual report models and were left as submitted.
