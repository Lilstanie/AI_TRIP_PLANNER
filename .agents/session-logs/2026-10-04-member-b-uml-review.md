---
date: 2026-10-04
author: Codex assisting Tingsong Jin
branch: docs/member-b-uml-review
pr: none
area: docs/design/stage1, docs/design/diagrams/member-b
contract-impact: none
---

# Add member B behaviour models with explicit UML conditions

## What changed

- Added AH-B1 and six classified requirements, UC-B1, and B activity/sequence/state models in paired English and Chinese pages.
- Added editable Mermaid sources and SVG/PNG figures; linked B materials from the Stage 1 index.
- Used guarded activity decisions, optional transport revision, explicit non-improving loop termination and event/guard/action state labels.
- Preserved current pricing gaps, deterministic validation and bounded revision semantics; no runtime code or contribution percentages changed.

## Validation

- Mermaid 10.9.3 parsed and Chromium rendered all three diagrams; exported PNGs visually inspected.
- Source reviewed against main at 7033a57; relevant transport/workflow implementation unchanged from the pinned source links.
- `node scripts/verify-docs.mjs`: passed.
- Four changed documentation pairs reviewed for semantic equivalence and recorded with `check-pairs.mjs --record`.
- No application tests run: documentation and diagrams only.

## Notes for the next person

Part of #137. Member review, video recording, specific group-contribution details and final report/slide integration remain outside this PR. The group submission artifacts are not regenerated here.
