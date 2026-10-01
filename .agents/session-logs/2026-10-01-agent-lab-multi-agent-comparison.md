---
date: 2026-10-01
author: Claude
branch: feature/agent-lab-multi-agent-comparison
pr: none
area: apps/web, packages/orchestrator, packages/shared, docs
contract-impact: packages/shared
---

# Compare single-agent and no-revision multi-agent strategies in Agent Lab

## What changed

- Added `multi-agent-no-revision`: the five registered specialists run through the real LangGraph
  workflow and planning board for one round, with the scenario's own preferences as memory and each
  specialist's tool calls attributed in the trace.
- Moved strategy selection into a registry used by the shared runner, which now also reports
  `latencyMs`, `rounds`, `toolCalls`, `fallbacks`, `failedAgents` and `unresolvedConflicts`.
- Split the Agent Lab page into timeline, plan, metrics and comparison components. Events carry a
  text label for Run, Graph stage, Specialist or Tool; Compare both strategies shows a figures table,
  both plans and both traces from the artifacts, with notes on what the comparison does and does not
  measure.
- Added a second browser E2E with a pre-code failure inventory and repeatable artifacts under the
  ignored `output/playwright/agent-lab-comparison/`.
- Updated paired English/Chinese API, architecture, workspace UI and roadmap docs and added an Agent Note.

## Why

A baseline needs a fair counterpart. Using the real graph with one round isolates specialization from
the repair loop, and measuring both through one runner keeps the figures comparable.

## Validation

- Failure inventories and failing tests were written before the code for the strategy, the comparison
  figures and the endpoint; the comparison E2E also states its inventory first.
- Comparison E2E and the original single-agent E2E: passed on desktop and phone against a dev server
  started with `USE_MOCK_TOOLS=true` and no model or provider keys.

## Notes for the next person

The dev server must run without model or provider keys (or with `USE_MOCK_TOOLS=true` and empty keys,
as `.env.local` otherwise selects live providers): the multi-agent fixture run does not guard against
them, by the owner's choice. The baseline replays a scripted plan, so its tool-call count is not a
like-for-like workload.
