---
date: 2026-10-03
author: Claude Code, for HeadmasterEggy (C)
branch: docs/stage1-report-models
pr: none
area: docs
contract-impact: none
---

# Add the ELEC5620 Stage 1 design model under docs/design/stage1/

## What changed

- `docs/design/stage1/01-requirements.md`: ad hoc requirement AH-C1, requirement classification, feature diagram with cross-tree constraints and NFRs.
- `docs/design/stage1/02-use-cases.md`: use case table, UC-C1 Arrange Accommodation, UC-C2 Manage Budget, and a template for A, B, D and E.
- `docs/design/stage1/03-structure.md`: generalisation diagram (the typed `Error` subclasses), object diagram, collaboration, structured class.
- `docs/design/stage1/04-member-c-behaviour.md`: C's activity, sequence and state machine diagrams.
- `docs/design/diagrams/`: SVG and PNG renders of every new Mermaid block.
- Chinese pairs for all five pages; the index is linked from `docs/README.md` and its pair.

## Why

The 14 Sep gap analysis found these Stage 1 marking items missing from `docs/design/`. The README is
one index mapping every marking item to its page, reusing the existing class and use case diagrams.

## Validation

Every Mermaid block rendered with mermaid-cli 11 without errors. `check-pairs.mjs` (20 pairs),
`verify-docs.mjs` and `verify-protected-files.mjs` pass. No code changed.

## Notes for the next person

Transport and dining costs in the object diagram are illustrative. A, B, D and E still have to add
their own ad hoc requirement, use case spec and behaviour diagrams.
