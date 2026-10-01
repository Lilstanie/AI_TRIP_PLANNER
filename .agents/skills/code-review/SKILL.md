---
name: code-review
description: Review a pull request or diff in AI_TRIP_PLANNER against the defect classes this repository has actually shipped or nearly shipped, on top of general correctness. Use when reviewing a pull request or diff, including self-review before opening one.
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
- **Labels and verdicts come from the data.** A status the page prints ("Within budget", "Passed")
  must be read from the field that decides it, never a constant. Agent Lab's first slice shipped a
  fixed "Within budget" label and a page that showed a figure its artifact did not hold. A comparison
  page must not rank what it only measures.
- **A check must be able to fail.** An evaluator measures the rules its scenario states, not a
  convenient subset, and each acceptance criterion needs a check that fails when it is broken. A
  sign-in-gate criterion no test could observe was caught only by review. Prefer metrics a plain
  script can recompute from the artifact, as `agent-lab-revision.e2e.mjs` does, over a model judge.
  [Agent Lab review fixes](../../session-logs/2026-10-01-agent-lab-review-fixes.md)
- **Optional services stay optional.** Accounts (Clerk) and the database (Neon) switch on only when
  their keys are set; without them the workspace stays single-user and local, the account routes
  answer 503 and `pnpm build` still passes. Check both modes, and that API contracts are not
  redirected to sign-in. [accounts](../../notes/implemented/architecture/2026-09-27-accounts-settings-sync.md)
- **Observers never steer.** A hook or trace that reports a decision (`onDecision`, Agent Lab events)
  must not change the plan, must cost nothing when no one listens, and must survive a consumer that
  throws. A versioned artifact keeps its `schemaVersion` only while nothing released reads the old shape.
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
