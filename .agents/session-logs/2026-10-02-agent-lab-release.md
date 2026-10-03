---
date: 2026-10-02
author: Claude
branch: feature/agent-lab-release
pr: none
area: apps/web, docs
contract-impact: none
---

# Complete the public Agent Lab: four views, one outcome vocabulary, release evidence (#107)

## What changed

- `AgentLabClient.tsx`: the views are Run, Compare, Failures and Architecture; `ArchitectureView.tsx` replaces
  `DesignNotes.tsx`; `OutcomeBadge.tsx` words how a run ended in Run, Compare and Failures.
- `fault-outcome.ts`: a run with conflicts left, or stopped by an infeasible budget, no longer reads as completed
  without a failure.
- `agent-lab.css`: Architecture styles, the glossary layout, reduced motion, and a light-theme strengthening of the
  lab's secondary text and primary button (found by the contrast probe).
- Tests written first: `agent-lab-release.e2e.mjs` (failure inventory in its header); the outcome tests. Five older
  E2Es were updated for the new button names, the renamed outcome attribute and the Architecture view. Docs (en and
  zh), an Agent Note.

## Why

See the Agent Note. The probe measured contrast from pixels and found real misses at 4.1 to 4.4 in the light theme.
The first two probe designs were wrong (it could not resolve gradients, then misread `color-mix` values); both were
fixed in the script, not by loosening it.

## Validation

- Release E2E: 171 of 171 passed (views, three scenarios under three strategies, five faults, download and offline
  replay, a layout matrix over light, dark, 1440, 390, 320 and reduced motion, keyboard, storage and workspace).
  Evidence under `output/playwright/agent-lab-release/`.
- Other Agent Lab E2Es: single-agent 72, comparison 155, revision 77, replay 71, benchmarks 80, failures 129 and live
  gate 55, all passed.
- The workspace's `settings` and `timeline` E2Es do not pass here: `settings` cannot find a button named Settings
  and `timeline` logs 502s without provider keys. No workspace file changed on this branch; they look stale or
  environmental and were not investigated.
- `pnpm typecheck`, `lint`, `test` (shared 49, services 4, tools 113, agents 124, orchestrator 223, web 450),
  `test:scripts` (26), `build`, `verify:docs`, `verify:protected`, the pair check (15) and Prettier on the changed files:
  all passed.

## Notes for the next person

- This branch is based on #106's branch, which contains #105. It has no PR yet.
- `settings.e2e.mjs` and `timeline.e2e.mjs` need attention separately.
