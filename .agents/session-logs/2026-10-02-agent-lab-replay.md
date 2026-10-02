---
date: 2026-10-02
author: Claude
branch: feature/agent-lab-replay
pr: none
area: apps/web, docs
contract-impact: none
---

# Download and replay Agent Lab run artifacts (#103)

## What changed

- `apps/web/lib/agent-lab/replay.ts`: file validation with stated reasons, timed replay, download.
- `AgentLabClient.tsx`, `ComparisonPanel.tsx`, new `DownloadArtifactButton.tsx`: Download artifact on
  every completed run, Replay artifact and Stop replay, replay label, status and alert announcements.
- `apps/web/tests/e2e/agent-lab-replay.e2e.mjs`: written first, with its failure inventory.
- Docs (en and zh): workspace UI, architecture, roadmap, development; new Agent Note
  `2026-10-02-agent-lab-artifact-replay.md`.

## Why

Replay stays in the browser so it works offline and needs no server storage; see the Agent Note for
the alternatives (server-stored runs, in-page metric recompute, bundled sample).

## Validation

- New replay E2E: 71 of 71 checks passed (download, offline replay equality and timing, 17 refusals, stop,
  keyboard, phone width). Evidence in `output/playwright/agent-lab-replay/`.
- Existing single-agent, comparison and revision E2Es: all passed against the same server.
- The first replay run failed one check from a race in the test (a stale "Replay complete"); fixed
  in the script, not the page.
- Servers ran with `USE_MOCK_TOOLS=true` and every key blanked, through a temporary launch entry that
  is not committed.
- `pnpm typecheck`, `lint`, `test` (agents 117, orchestrator 159, web 405), `test:scripts` (26), `build`,
  `verify:docs`, `verify:protected`, the pair check (15 pairs) and Prettier: all passed.

## Notes for the next person

- Fixture runs do not force mock tools. With provider keys in the environment the multi-agent
  strategies call the real model and providers (a first attempt here did, and one run timed out).
  Issue #106 owns closing this.
- Metrics in a replayed file are shown as stored, not recomputed.
- No bundled sample artifact; failed-run artifacts are refused until #105.
