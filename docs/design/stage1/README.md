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
| Activity diagram\*                                                                | 1.5   | [Individual items](#individual-items)                                                                                                                                           |
| Sequence diagram\*                                                                | 1.5   | [Individual items](#individual-items)                                                                                                                                           |
| State machine diagram\*                                                           | 1.5   | [Individual items](#individual-items)                                                                                                                                           |
| Architecture viewpoints (optional)                                                | —     | [Architecture diagrams](../../architecture-diagrams.md): system overview, agent collaboration, chat stream sequence, plan-section lifecycle, storage sync                       |

Rendered SVG and PNG files for the requirement and structure diagrams are in [`../diagrams/`](../diagrams/). Member C's activity, sequence and state machine diagrams are rendered as Archify views under [`../../architecture-diagrams/stage1-member-c/`](../../architecture-diagrams.md#elec5620-stage-1-member-c-behaviour).

## Individual items

Each member's activity, sequence and state machine diagrams come from **their own** ad hoc
requirement and use case specification.

| Member                | Ad hoc requirement and classification            | Use case                                                                  | Behaviour models                                     |
| --------------------- | ------------------------------------------------ | ------------------------------------------------------------------------- | ---------------------------------------------------- |
| A (`@Lilstanie`)      | [AH-A1, R-Ax](01-requirements.md#member-a-ah-a1) | [UC-A1](02-use-cases.md#uc-a1-generate-itinerary)                         | [04-member-a-behaviour.md](04-member-a-behaviour.md) |
| B (`@fonever2`)       | [AH-B1, R-Bx](01-requirements.md#member-b-ah-b1) | [UC-B1](02-use-cases.md#uc-b1-arrange-transportation)                     | [04-member-b-behaviour.md](04-member-b-behaviour.md) |
| C (`@HeadmasterEggy`) | [AH-C1, R-Cx](01-requirements.md#member-c-ah-c1) | [UC-C1, UC-C2](02-use-cases.md#uc-c1-arrange-accommodation)               | [04-member-c-behaviour.md](04-member-c-behaviour.md) |
| D (`@jbia0391`)       | [AH-D1, R-Dx](01-requirements.md#member-d-ah-d1) | [UC-D1](02-use-cases.md#uc-d1-view-weather-based-clothing-recommendation) | [04-member-d-behaviour.md](04-member-d-behaviour.md) |
| E (`@WhW0591`)        | [AH-E1, R-Ex](01-requirements.md#member-e-ah-e1) | [UC-E1](02-use-cases.md#uc-e1-edit-itinerary-timeline--map)               | [04-member-e-behaviour.md](04-member-e-behaviour.md) |

## Contribution table

Each member's share of each group item; each row adds up to 100%. The full table is in report §13.1.

| Item                                      | A   | B   | C   | D   | E   |
| ----------------------------------------- | --- | --- | --- | --- | --- |
| Feature diagram                           | 20% | 20% | 20% | 20% | 20% |
| Use case diagram                          | 20% | 20% | 20% | 20% | 20% |
| Class diagram                             | 20% | 20% | 20% | 20% | 20% |
| Object / collaboration / structured class | 20% | 20% | 20% | 20% | 20% |

## Generative AI acknowledgement

Parts of these pages were drafted with Claude (Anthropic) from the repository code. The Canvas
compliance statement requires any use of generative AI to be acknowledged; report §13.3 says so.
