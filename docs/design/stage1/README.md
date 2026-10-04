# ELEC5620 Stage 1 design model

English | [中文](README.zh.md)

This is the index for the Stage 1 report: every marking item and the page that covers it. The
models are drawn from the code on `main`, so they match the implementation rather than the earlier
Google Doc plan. The main difference is that the shipped product has **no approval checkpoint**:
the traveller changes a plan in chat or in the editor (`packages/shared/src/plan.ts`).

## Marking items

\* marks an individual item: every member writes their own.

| Marking item                                                                      | Marks | Where                                                                                                                                                                           |
| --------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ad hoc requirements\*                                                             | 0.5   | [01-requirements.md §1.2](01-requirements.md#12-ad-hoc-requirements-individual-at-least-one-per-member)                                                                         |
| Feature diagram, with NFRs                                                        | 1     | [01-requirements.md §1.4](01-requirements.md#14-feature-diagram-group)                                                                                                          |
| Overall use case diagram                                                          | 1     | [use-case-diagram.svg](../diagrams/use-case-diagram.svg)                                                                                                                        |
| Use case specifications\*                                                         | 2     | [02-use-cases.md](02-use-cases.md)                                                                                                                                              |
| Class diagram: generalisation, composition, aggregation, interfaces, multiplicity | 3     | [class-diagram.md](../class-diagram.md) diagrams 1–5, plus diagram 6 in [03-structure.md §3.1](03-structure.md#31-elementary-structure-generalisation-added-to-the-class-model) |
| Object diagram, collaboration, structured class                                   | 3     | [03-structure.md §3.2–3.4](03-structure.md#32-object-diagram)                                                                                                                   |
| Activity diagram\*                                                                | 1.5   | Member C: [04-member-c-behaviour.md §4.1](04-member-c-behaviour.md#41-activity-diagram-arrange-accommodation-uc-c1)                                                             |
| Sequence diagram\*                                                                | 1.5   | Member C: [§4.2](04-member-c-behaviour.md#42-sequence-diagram-budget-overrun-and-targeted-revision-uc-c2-extension-2a)                                                          |
| State machine diagram\*                                                           | 1.5   | Member C: [§4.3](04-member-c-behaviour.md#43-state-machine-accommodation-section-within-a-planning-turn-uc-c1-and-uc-c2)                                                        |
| Architecture viewpoints (optional)                                                | —     | [Architecture diagrams](../../architecture-diagrams.md): system overview, agent collaboration, chat stream sequence, plan-section lifecycle, storage sync                       |

Rendered SVG and PNG files for the requirement and structure diagrams are in [`../diagrams/`](../diagrams/). Member C's activity, sequence and state machine diagrams are rendered as Archify views under [`../../architecture-diagrams/stage1-member-c/`](../../architecture-diagrams.md#elec5620-stage-1-member-c-behaviour).

## What each other member still has to write

Each member's activity, sequence and state machine diagrams must come from **their own** ad hoc
requirement and use case specification. A, D and E each still need to add:

1. One ad hoc requirement in [01-requirements.md §1.2](01-requirements.md#12-ad-hoc-requirements-individual-at-least-one-per-member).
2. At least one use case specification in [02-use-cases.md](02-use-cases.md), from the template in §2.3.
3. One activity, one sequence and one state machine diagram built from that use case, in a new
   `04-member-<x>-behaviour.md` page.

Member B: [AH-B1 and requirements](01-requirements.md#15-member-b-requirement-classification), [UC-B1](02-use-cases.md#24-uc-b1-arrange-transportation), and [three behaviour models](04-member-b-behaviour.md).

## Contribution table (fill in before submitting)

| Item                                      | A   | B   | C   | D   | E   |
| ----------------------------------------- | --- | --- | --- | --- | --- |
| Feature diagram                           |     |     |     |     |     |
| Use case diagram                          |     |     |     |     |     |
| Class diagram                             |     |     |     |     |     |
| Object / collaboration / structured class |     |     |     |     |     |

## Generative AI acknowledgement

Parts of these pages were drafted with an AI assistant from the repository code. The Canvas
compliance statement requires any use of generative AI to be acknowledged, so say so in the report.
Every member should also be able to explain their own diagrams in the week 11/12 interview.
