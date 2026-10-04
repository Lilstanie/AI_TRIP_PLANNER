---
date: 2026-10-04
author: Claude Opus 5 (with A / @Lilstanie)
branch: docs/stage1-member-a-behaviour
pr: none
area: docs
contract-impact: none
---

# Stage 1 individual models for member A

## What changed

- `docs/design/stage1/01-requirements.md` §1.2: AH-A1 in the traveller's words; §1.3: R-A1–R-A12
  classified and traced to real code.
- `docs/design/stage1/02-use-cases.md`: new §2.3 UC-A1 Generate Itinerary; the template moved to §2.4.
- `docs/design/stage1/04-member-a-behaviour.md` (new): activity, sequence and state machine diagrams
  from UC-A1, plus a table of the three LLM calls in a turn and the deterministic guard on each.
- `docs/design/diagrams/stage1-member-a-{activity,sequence,state}.svg` (new), linked from the page.
- `docs/design/stage1/README.md`: diagram rows point at member A's page; A removed from the list of
  members who still owe one.
- `.zh.md` written for every page above; pairs recorded.

## Why

Issue #136 asks for member A's individual models by 4 Oct. Scope was chosen to avoid double-claiming:
member C's UC-C2 and R-C11 already cover `detectConflicts`, `rollUpCost`, `planScore` and the round
limit, R-C11 tracing to `workflow.ts`. A's pages therefore cover brief extraction and clarifying
questions, the workflow's routing (`routeAfterDetection`, `reviseConflicts`, `stalled`) and Agent Lab,
rather than restating conflict detection.

## Validation

`pnpm verify:docs`, `pnpm verify:protected` and the translation pairing check pass. Docs-only, and
the code checks were run anyway: `pnpm typecheck` 6/6, `pnpm test` 980/980, `pnpm lint`, `pnpm build`.
All three Mermaid diagrams were rendered with mermaid 11 before the SVGs were exported, not merely
eyeballed.

## Notes for the next person

- R-C11 traces the round limit and plan score to `workflow.ts`, which `docs/team-workflow.md` assigns
  to A. The overlap with R-A7/R-A9 is unresolved and is A's to settle with C.
- The report's own §1.4 role line is outside this repo; the phrase quoted in #136 appears nowhere here.
- The contribution table in `README.md` is still blank: it is a group decision, not one member's.
- `README.md` requires the report to acknowledge generative AI, and each member to be able to explain
  their own diagrams in the week 11/12 interview.
