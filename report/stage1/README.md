# ELEC5620 Stage 1: missing report models

These files fill the gaps the 14 Sep gap analysis found between the Stage 1 marking criteria and
what was already in `docs/design/`. They are drawn from the code on `main` (commit `921ae73`), so the
models match the implementation rather than the earlier Google Doc plan. The main difference is that
the shipped product has **no approval checkpoint**: the traveller changes a plan in chat or in the
editor (`packages/shared/src/plan.ts`).

| File | Marking item | Marks | Kind |
| --- | --- | --- | --- |
| [01-requirements.md](01-requirements.md) | Ad hoc requirements, requirement classification, feature diagram with NFRs | 0.5 + 1 | Individual + group |
| [02-use-cases.md](02-use-cases.md) | Use case specifications (C's two, a template for the others) | 2 | Individual |
| [03-structure.md](03-structure.md) | Generalisation added to the class model; object diagram, collaboration, structured class | 3 + 3 | Group |
| [04-member-c-behaviour.md](04-member-c-behaviour.md) | C's activity, sequence and state machine diagrams | 1.5 × 3 | Individual |

Already in the repo and reusable as is: the class model (`docs/design/class-diagram.md`, five
diagrams) and the use case diagram (`docs/design/diagrams/use-case-diagram.svg`). Rendered SVGs of
every new diagram are in [`diagrams/`](diagrams/).

## What each other member still has to write

The items marked * in the criteria are individual. Each member's activity, sequence and state
machine diagrams must come from **their own** ad hoc requirement and use case specification, so
A, B, D and E each need to add:

1. One ad hoc requirement in `01-requirements.md` §1.2.
2. One or more use case specifications in `02-use-cases.md`, using the template in §3.
3. One activity, one sequence and one state machine diagram built from that use case.

## Contribution table (fill in before submitting)

| Item | A | B | C | D | E |
| --- | --- | --- | --- | --- | --- |
| Feature diagram | | | | | |
| Use case diagram | | | | | |
| Class diagram | | | | | |
| Object / collaboration / structured class | | | | | |

## Generative AI acknowledgement

These drafts were produced with an AI assistant from the repository code. The Canvas compliance
statement requires any use of generative AI to be acknowledged, so say so in the report. Every member
should also be able to explain their own diagrams in the week 11/12 interview.
