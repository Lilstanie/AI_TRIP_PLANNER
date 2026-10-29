---
date: 2026-10-29
author: Codex
branch: docs/TP-28-transport-origin
pr: 784
area: docs, submission/stage1
contract-impact: none
---

# Correct UC-B1 preference order

## What changed

- Documented the departure_city preference ahead of transport.origin in both design pages and the report.
- Regenerated the report with the local adapter and existing verified Mermaid diagrams.

## Validation

- Checked the transport origin selection against packages/agents/src/transport/index.ts.
- See PR evidence for documentation and formatting checks.

## Notes for the next person

- Local Chrome reflows the PDF relative to the original Linux build.
