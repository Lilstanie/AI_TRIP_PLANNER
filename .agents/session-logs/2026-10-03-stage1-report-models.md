---
date: 2026-10-03
author: Claude Code, for HeadmasterEggy (C)
branch: docs/stage1-report-models
pr: none
area: report
contract-impact: none
---

# Add the missing ELEC5620 Stage 1 report models under report/stage1/

## What changed

- `report/stage1/01-requirements.md`: ad hoc requirement AH-C1, requirement classification, feature diagram with cross-tree constraints and NFRs.
- `report/stage1/02-use-cases.md`: use case table, UC-C1 Arrange Accommodation, UC-C2 Manage Budget, and a template for A, B, D and E.
- `report/stage1/03-structure.md`: generalisation diagram (the typed `Error` subclasses), object diagram, collaboration, structured class.
- `report/stage1/04-member-c-behaviour.md`: C's activity, sequence and state machine diagrams.
- `report/stage1/diagrams/`: SVG and PNG renders of every Mermaid block.

## Why

The 14 Sep gap analysis found these Stage 1 marking items missing from `docs/design/`. They live
outside `docs/` because they are coursework, not product documentation, so they need no Chinese pair.

## Validation

Every Mermaid block was rendered with mermaid-cli 11 without errors. No code changed.

## Notes for the next person

Transport and dining costs in the object diagram are illustrative. A, B, D and E still have to add
their own ad hoc requirement, use case spec and behaviour diagrams.
