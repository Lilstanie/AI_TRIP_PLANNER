# 4. Behaviour models: member E (`@WhW0591`, chat workspace, timeline and map editing)

English | [中文](04-member-e-behaviour.zh.md)

These models derive from **AH-E1 / R-E1–R-E6** in [Requirements](01-requirements.md#member-e-ah-e1) and
**UC-E1 Edit Itinerary (Timeline / Map)** in [Use cases](02-use-cases.md#uc-e1-edit-itinerary-timeline--map).
The chat coordinator can update the brief or replan, but it has no edit tool; the timeline and map edit
path is deterministic from preview through local application.

## 4.1 Activity diagram: Edit Itinerary (UC-E1)

The activity diagram separates the current chat path from the implemented Timeline/Map edit path. The
chat coordinator can update the brief or replan, but it does not produce an `EditRequest`. The edit path
is deterministic from preview through local application.

## 4.2 Sequence diagram: Timeline/Map edit with preview and version check (UC-E1)

The sequence diagram shows the implemented Timeline/Map path and marks chat as a separate coordinator
path. The important control point is the browser-side comparison of `preview.baseVersion` and the
current plan version; persistence is local and there is no server-side atomic commit.

## 4.3 State machine: Timeline/Map edit lifecycle (UC-E1)

The state machine models the implemented Timeline/Map edit lifecycle. It does not include chat
interpretation because the current chat coordinator has no edit tool. The preview is either blocked,
cancelled or applied after the client-side version check; the resulting plan is then saved locally.
