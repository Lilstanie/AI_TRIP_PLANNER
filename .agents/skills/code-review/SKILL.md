---
name: code-review
description: Use when reviewing a pull request or diff in AI_TRIP_PLANNER, including self-review before opening one, to check the defect classes this repository has actually shipped or nearly shipped, on top of general correctness.
---

# Reviewing an AI_TRIP_PLANNER change

This is guidance, not a complete checklist. Read the diff against its real base
(`git diff origin/main...HEAD`) and enough surrounding code to understand the design. Prioritise
correctness, data truthfulness and broken behaviour over style; one substantiated blocker is worth
more than a list of nits. Report each finding with the file, the concrete failure and how to trigger
it.

## Repository-specific checks

Each item below is a defect this project has hit; the source is in brackets.

- **Unit and scale conversions that schemas cannot catch.** Provider ratings on 1–5 must become the
  project's 0–10 (`× 2`); per-passenger fares must become whole-group totals; every stored amount is
  AUD. Zod accepts the unconverted value, so require behavioral evidence for the converted number.
  Prefer an E2E assertion; when isolation is necessary, check that failure modes were enumerated
  before implementation and that the focused check covers them.
  [SerpApi and Places notes](../../notes/implemented/feature/2026-09-20-serpapi-live-prices.md)
- **Data provenance tells the truth.** Each specialist sets `source.kind` in the branch that actually
  ran, including its fallback `catch`. A label derived from configuration is wrong exactly when a call
  degrades. [source kind](../../notes/implemented/bug-fix/2026-09-21-proposal-source-kind.md)
- **Mock versus live is per request.** Code must call `mockEnabled()`, never read
  `process.env.USE_MOCK_TOOLS` or write `process.env` per request.
  [data mode](../../notes/implemented/feature/2026-09-21-request-scoped-data-mode.md)
- **Do not invent unknown facts.** Missing cancellation policies stay `false`, missing coordinates
  stay absent, estimated prices are labelled as estimates.
- **Shared contracts.** A change under `packages/shared/src` needs an Agent Note and
  `contract-impact: packages/shared` in the session log; check every consumer still compiles and that
  removed fields are stripped, not rejected, when old data is parsed.
- **Persisted browser data.** A change to a stored trip field needs a snapshot version bump and a stated
  decision about old snapshots. [storage](../../notes/implemented/architecture/2026-09-24-workspace-catalog-trip-storage.md)
- **Late responses.** Editing, switching or starting trips must abort or ignore in-flight requests so
  a late response cannot overwrite newer state.
- **Boundaries.** Agents reach providers only through ports; `route.ts` files stay thin adapters;
  production and test files stay at or below 1000 lines ([development.md](../../../docs/development.md)).
- **Secrets.** No key in code, fixtures, logs, docs or test output.
- **Documentation.** Affected `docs/` pages and Agent Notes change in the same PR; no frozen file is
  touched (`pnpm verify:protected`).

## Evidence

A review claim about behaviour needs evidence: a failing test, a reproduced request, or a quoted line.
For UI changes, ask for the evidence described in [ui-verification](../ui-verification/SKILL.md).
