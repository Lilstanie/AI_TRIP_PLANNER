# README and documentation refresh

## Session summary

- Author: Claude Code (Opus 5)
- Date: 2026-09-17
- Baseline: `codex/ui-improvements` at `860bba9`, pushed before this change.
- Modules: `README.md`, `.env.example`, `docs/`.
- Goal: check an external README review against the code and update README and docs where they no
  longer match it.
- Contract impact: none; documentation and `.env.example` comments only.

## Review findings checked against code

Confirmed and fixed:

- README said the migration had landed and, later, that `main` was still on the compatibility path.
  The code confirms the migration: `workflow.ts` imports `@langchain/langgraph` and calls
  `dispatchWithSupervisor` / `reviseWithSupervisor`, and `supervisor.ts` uses `createAgent`. PR #10
  merged it. The stale sentence is gone and `docs/agent-architecture.md` no longer says “not yet
  merged”.
- README listed one of six API routes, and `docs/api.md` said HITL was not reconnected. Both now cover
  `chat`, `hitl`, `places/search`, `places/details`, `routes/from-location` and `trip/preview-edit`
  with request examples, status codes and contract files. A reference to the non-existent
  `packages/shared/src/trip.ts` was replaced.
- The architecture diagram implied the supervisor drives the workflow. It now shows the graph driving
  the supervisor, with GPT extraction, the local parser, deterministic dispatch and fallbacks, the
  memory store, the HITL route and the Google routes.
- The model description was outdated: `MODEL_ROUTING` sends all five specialists to DeepSeek, which
  also drives the supervisor and replies. README, `docs/langgraph-orchestration.md` and
  `docs/scaffold.md` now match, including GPT-then-Anthropic extraction.
- Setup order (copy `.env.example` before `pnpm dev`), the pinned pnpm version, the CI badge and
  commands, the Windows note for the web test script, the `OSM_USER_AGENT` placeholder warning, the
  full `packages/services` exports, the docs index and an explicit licence statement were added.

Checked and corrected differently from the review:

- `pnpm mock-server` is not a required Quick start step. No code reads `MOCK_API_URL`;
  `USE_MOCK_TOOLS=true` uses in-process fixtures, and only Docker Compose starts the stub server.
  README and `docs/development.md` describe it as optional.
- The existing Playwright screenshots (`output/playwright/`) are git-ignored and predate the current
  workspace, so they were not linked. A headless capture against the dev server hung on its HMR
  connection and was abandoned; no screenshot was added.
- The review did not mention the Google Maps keys. `.env.example` now documents `MAPS_API_KEY` for
  the server routes and the missing `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and
  `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`, plus how `MAPS_PROVIDER` is chosen. `MOCK_API_URL` and
  `DATABASE_URL` are marked as not read by current code.

Other stale statements updated: `docs/roadmap.md` has status per step, `docs/scaffold.md` renames
`buildHitl` to `checkpointsFor` and describes the real map adapters, and `docs/accommodation.md`
has a dated note that the chat entry no longer depends on `DEMO_BRIEF`. Point-in-time documents
(`elec5620-lab-1-6-gap-analysis.md`, `b-reliability.md`, earlier session logs) were left as
historical records.

## Verification

- Every relative link in the edited files resolves, and every code path they cite exists, except
  the intentional `YYYY-MM-DD-name.md` template placeholder.
- The CI workflow `.github/workflows/ci.yml` is active on `Lilstanie/AI_TRIP_PLANNER`, matching the
  badge URL.
- Prettier passes for every edited file that was Prettier-clean before;
  `docs/agent-architecture.md` already had table formatting differences and was not reformatted.
- Not verified: the hosted demo's configuration. The note that it uses mock fixtures relies on the
  review's live observation of “Mock attraction near Tokyo & Kyoto”. The Mermaid diagram was not
  rendered locally.
