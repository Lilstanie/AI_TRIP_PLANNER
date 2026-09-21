---
date: 2026-09-21
author: DeepSeek Harness agent
branch: fix/ui-interaction
pr: none
area: docs
contract-impact: none
---

# Record the DSH thinking UI this project imitates

## What changed

- `docs/design/dsh-thinking-ui.md` — new. Describes how DeepSeek Harness renders a turn (running
  line, Think row, process fold, tool rows, subagent rows, icons and motion), then compares it with
  `apps/web/components/chat/ThinkingProcess.tsx` and lists the gaps in priority order.
- `docs/workspace-ui.md` — corrected the planning-progress bullet, which still described the
  per-agent detail as "native, collapsed `<details>` controls"; the component uses `aria-expanded`
  buttons. Linked the new reference from that bullet.
- `README.md` — added the reference to the documentation table.

## Why

`ThinkingProcess.tsx` already uses DSH's vocabulary (Think, Subagent, "Deep diving", per-agent
rows, a sweep on the running row) but nothing recorded what it was imitating, so there was no way to
tell an intentional divergence from a missing one. The new document is that record: it cites DSH by
path and line, states the timings, and separates the three findings that matter most — this project
currently shows two live "Deep diving" indicators for one turn, keeps all five subagent rows after
the run settles, and expresses status as text glyphs animated by an opacity fade where DSH uses a
stepped state dot.

It is a reference, not a plan: nothing in `apps/web` was changed.

## Validation

- `pnpm typecheck` — 6/6 tasks successful
- `pnpm lint` — no ESLint warnings or errors
- `pnpm test` — 467 passed across 44 files (shared 29, services 4, tools 82, agents 95,
  orchestrator 65, web 192)

## Notes for the next person

- The thinking surface itself is uncommitted in this working tree. The reference describes that
  state, so re-check the gap table if `ThinkingProcess.tsx` moves first.
- `pnpm format` rewrites the quoted DSH code blocks in the new document (single quotes become
  double, semicolons added). The excerpts are meant to stay verbatim, so do not run Prettier over
  that file casually; the rest of `docs/` already fails `prettier --check` and Prettier is not a CI
  gate here (CI runs typecheck, lint, test, build).
- `tokens.css` has no `--error` token. Step 4.2 of the document needs one to separate a failure
  from the existing amber warning.
