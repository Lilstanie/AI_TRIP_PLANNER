---
date: 2026-09-22
author: Claude Code, with @HeadmasterEggy
branch: docs/redraw-class-diagram
pr: none
area: docs/design
contract-impact: none
---

# Redraw the class model from the current code

## What changed

- `docs/design/class-diagram.md`: all five Mermaid diagrams and the tables rebuilt from
  `packages/*/src` and `apps/web`. Function modules appear as `«module»`, React components and
  hooks as `«component»` / `«hook»`.
- Gone: `HitlCheckpoint` and its enums, `resume()`, the planned `ConflictDetector` and
  `CostAggregator` classes, USD fields, the payment service. Added: `WeatherPort`, `DataMode`,
  SerpApi, `ProviderProvenance`, `AgentProposalSource`, `StaySelection`, `JsonStore`, `TripStore`,
  the workspace hooks.
- Use case 7 "Confirm Key Itinerary (HITL)" became "Edit Itinerary (Timeline / Map)", which extends
  Generate Itinerary and includes Manage Budget, traced to `TripEditor`.
- `class-1` to `class-5` SVGs re-rendered; `use-case-diagram.svg` and
  `combined-architecture-map.svg` edited by hand to match.

## Why

The owner chose to redraw rather than label the old design model as historical.

## Validation

- Every signature, field and relationship read from the code; checked names include
  `IncompleteBriefError(missing, known)`, `dispatchWithSupervisor(options)`,
  `createRoutedStructuredInvoker(task, schema, name)`, the destination guide's missing
  `supportsRevision`, and `previewEdit`.
- Rendered with `@mermaid-js/mermaid-cli` 11.17.0 against local Chrome; all five compile.
- Both hand-drawn SVGs screenshotted with headless Chrome. `combined-architecture-map.svg` failed to
  parse on `main` because of an `&rarr;` entity; replaced with the character.
- `node scripts/verify-docs.mjs`: passes.

## Notes for the next person

- Re-render after editing a Mermaid block: extract it to a `.mmd` file and run `mmdc` with
  `-b white`; the two hand-drawn SVGs must be edited directly.
