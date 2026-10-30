---
name: review-trip-planner
description: Review a pull request or diff in AI_TRIP_PLANNER against the defect classes this repository has actually shipped or nearly shipped, on top of general correctness. Use when reviewing a pull request or diff, including self-review before opening one.
---

# Review AI_TRIP_PLANNER risks

Prepare the [review handoff](references/handoff.md): comparison SHAs, tracked and untracked scope,
originating requirements, applicable rules and evidence. Use the actual target for a stacked PR.
Run the [scoped comment check](references/comment-policy.md) over the diff's JavaScript and TypeScript
paths; the repository default is no added explanatory comments. Use the versioned exact exception list for task-approved contract or tool instructions; review each
reason. The reference also owns the automatic PR/main gate and its reproduction command.

Before reporting a PR ready for delivery, run `node scripts/pr-delivery-status.mjs <number>` from a
clean checkout of its branch. The read-only preflight verifies that the local SHA is the open PR's
exact head, the base is `main`, and Summary, Evidence and Merge Danger are nonempty. Every reported
head check must succeed except a `CI / cli-acceptance-workers` skip accompanied by successful
`CI / cli-acceptance-plan` and `CI / cli-acceptance` checks from the same Actions run. It does not judge Evidence wording. Its
fixture self-check demonstrates checker behavior only, never GitHub CI or live-provider behavior.

This is guidance, not a complete checklist. Read the supplied diff against its real base
and enough surrounding code to understand the design. Prioritise
correctness, data truthfulness and broken behaviour over style; one substantiated blocker is worth
more than a list of nits. Report each finding with the file, the concrete failure and how to trigger
it.

## Repository-specific checks

Each item below is a defect this project has hit; the source is in brackets.

- **Unit and scale conversions that schemas cannot catch.** Provider ratings on 1–5 must become the
  project's 0–10 (`× 2`); fares must be whole-group totals, scaled only when the provider prices one
  passenger (Google Flights already prices every adult, so a second multiply doubles it); stored
  planning amounts are AUD. Zod accepts the unconverted value, so require behavioral evidence for the converted number.
  Prefer an E2E assertion; when isolation is necessary, check that failure modes were enumerated
  before implementation and that the focused check covers them.
  [SerpApi and Places notes](../../notes/implemented/feature/2026-09-20-serpapi-live-prices.md)
- **Behaviour change tested only by unit tests.** [CLAUDE.md](../../../CLAUDE.md) prefers E2E tests
  as the sole mechanism. A PR that changes behaviour under `packages/*/src` or `apps/web/lib` and has
  only Vitest tests needs either a `scripts/redgreen.mjs` before/after record in Evidence or a stated
  reason no E2E can cover it. Missing both is a finding.
  [2026-10-24 owner-c retro](/mnt/project-files/retro/2026-10-24-tp-owner-c-retro.md)
- **Planning and display have different owners.** Budget arithmetic, guardrails, scores and persisted
  planning totals stay in AUD. `budgetSource` preserves the entered amount and currency; native fare
  evidence keeps its provider currency. `effectiveCurrency(brief, fallback)` chooses the trip's
  `displayCurrency`, then `budgetSource.currency`, then Settings (the request fallback on the server,
  AUD for older clients). A trip's currency never writes Settings or follows interface language.
  Browser copy uses `money()`, `delta()`, `budgetGap()` and `fare()` from `useLocale()`, backed by
  [web money](../../../apps/web/lib/money.ts) and
  [LocaleProvider](../../../apps/web/components/account/LocaleProvider.tsx). Traveller-facing server
  summaries, progress, conflicts and replies use `formatMoney(amountAud, currency)` from
  [shared money](../../../packages/shared/src/money.ts); conversion there is correct. Keep numeric
  planning inputs in AUD and never parse formatted prose back into calculations. Converted displays
  carry the fixed-rate estimate notice. Flag hand-built amount strings or converted planning totals,
  not the established server formatter.
  [generated-text decision](../../notes/implemented/architecture/2026-10-07-one-money-formatter-for-generated-text.md),
  [trip currency](../../notes/implemented/feature/2026-10-07-trip-display-currency.md),
  [PR #229](https://github.com/Lilstanie/AI_TRIP_PLANNER/pull/229)
- **Authored interface copy is keyed.** JSX and accessible names go through `t()`; typechecking
  catches missing translations for keys, not literals that bypass `t()`. Authored notices
  outside components use `{ key, params }` and `NoticeError`, then `noticeBody`, `failureNotice` or
  `errorNotice` at the route/client boundary and `useLocale().notice()` to render. Stored edit notices
  use `storeNotice`/`readStoredNotice`; legacy raw text stays raw. Model/provider prose and traveller
  text are not translated by the interface; reply language is a prompt rule. Do not wrap a new
  authored sentence in `{ raw }` or assume every stored blocker is a keyed Notice (`conflictsWith`
  remains prose). Inspect the producer and consumer in
  [notice.ts](../../../apps/web/lib/i18n/notice.ts), not dictionary membership alone.
  [keyed notices](../../notes/implemented/architecture/2026-10-06-keyed-notices-everywhere.md),
  [reply language](../../notes/implemented/feature/2026-10-04-assistant-reply-language.md)
- **Data provenance tells the truth.** Each specialist sets `source.kind` in the branch that actually
  ran, including its fallback `catch`. A label derived from configuration is wrong exactly when a call
  degrades. [source kind](../../notes/implemented/bug-fix/2026-09-21-proposal-source-kind.md)
- **Mock versus live is per request.** Code must never read `process.env.USE_MOCK_TOOLS` or write
  `process.env` per request. Provider selection happens once per run inside the ToolGateway port
  modules from the snapshotted `dataMode`; elsewhere call `mockEnabled()`. Raw adapters stay out of
  the `@trip/tools` entry point.
  [data mode](../../notes/implemented/feature/2026-09-21-request-scoped-data-mode.md),
  [deep provider selection](../../notes/implemented/architecture/2026-10-03-deep-provider-selection.md)
- **Do not invent unknown facts.** Missing cancellation policies stay `false`, missing coordinates
  stay absent, estimated prices are labelled as estimates.
- **Shared contracts.** A change under `packages/shared/src` needs an Agent Note and
  `contract-impact: packages/shared` in the session log; check every consumer still compiles and that
  removed fields are stripped, not rejected, when old data is parsed. A tightened limit (a new
  maximum, a newly required field) must still load saved briefs and settings, and a new gate in the
  orchestrator must not block existing drafts. Another member's agents depend on the contract, so
  ask whether the team agreed to it. [PR #144](https://github.com/Lilstanie/AI_TRIP_PLANNER/pull/144)
- **One feature per PR, and CI that actually ran.** Unrelated features in one PR cannot be reviewed,
  reverted or merged alone; ask for a split. A PR from a fork waits on workflow approval
  (`action_required`), so a missing check is not a passing one: confirm the CI run finished on the
  head commit before approving. [PR #144](https://github.com/Lilstanie/AI_TRIP_PLANNER/pull/144)
- **Persisted browser data.** A change to a stored trip field needs a snapshot version bump and a stated
  decision about old snapshots. [storage](../../notes/implemented/architecture/2026-09-24-workspace-catalog-trip-storage.md)
- **Labels and verdicts come from the data.** A status the page prints ("Within budget", "Passed")
  must be read from the field that decides it, never a constant. Agent Lab's first slice shipped a
  fixed "Within budget" label and a page that showed a figure its artifact did not hold. A comparison
  page must not rank what it only measures.
- **A check must be able to fail.** An evaluator measures the rules its scenario states, not a
  convenient subset, and each acceptance criterion needs a check that fails when it is broken. A
  sign-in-gate criterion no test could observe was caught only by review. Prefer metrics a plain
  script can recompute from the artifact, as `agent-lab-failures.e2e.mjs` does, over a model judge.
  [Agent Lab review fixes](../../session-logs/2026-10-01-agent-lab-review-fixes.md)
- **Optional services stay optional.** Accounts (Clerk) and the database (Neon) switch on only when
  their keys are set; without them the workspace stays single-user and local, the account routes
  answer 503 and `pnpm build` still passes. Check both modes, and that API contracts are not
  redirected to sign-in. [accounts](../../notes/implemented/architecture/2026-09-27-accounts-settings-sync.md)
- **Observers never steer.** A hook or trace that reports a decision (`onDecision`, Agent Lab events)
  must not change the plan, must cost nothing when no one listens, and must survive a consumer that
  throws. A versioned artifact keeps its `schemaVersion` only while nothing released reads the old shape.
- **E2E waits name a state.** A wait in an E2E script waits for a locator or a request, never a fixed
  sleep, and every branch of an `.or()` or a `.catch()` it waits on exists on each layout the script runs
  (desktop and phone). A wait for a control a phone does not render sits out its whole timeout on every phone
  run; a fixed sleep fails on a cold dev server. `timeline` waited 30 s per phone run, and `itinerary` failed
  when the first server check compiled cold. [PR #258](https://github.com/Lilstanie/AI_TRIP_PLANNER/pull/258)
- **Undo with more than one change.** State that an undo or a cancel reverses (a flag, a count, a notice) is
  tested with two changes and one undo, not only one change and its undo. A flag cleared by the undo of the
  second change hid the first from the replan notice, and the single-change test passed.
  [PR #258](https://github.com/Lilstanie/AI_TRIP_PLANNER/pull/258)
- **Revision ownership and late responses.** Follow
  [feature wiring](../end-to-end-feature-wiring/SKILL.md) through the revision owner, background hooks
  and final apply. An edit synchronously aborts background work; a locally cancelled or replaced job
  is discarded and may be offered for the current plan when still needed. A cross-tab stale job is
  a terminal failure for that plan, shows a keyed stale notice and stops being offered until a fresh
  plan is loaded. Treating it as discarded creates a retry loop. Hold a response while editing,
  starting chat, switching trips or queueing behind another tab; check both the plan and further
  requests after release. Browser locks/local storage do not establish server-atomic or cross-device
  ownership, and storage failure weakens that protection. Signed-in account sync is the separate
  server owner: trips, conversations and settings update only when the submitted revision matches
  atomically, a conflict stays local and pending, and client `updatedAt`, timestamps or a retry
  never resolve it. Flag a sync path that overwrites on time order or acknowledges a rejected
  submission.
  [revision-based sync](../../notes/implemented/bug-fix/2026-10-14-revision-based-account-sync.md),
  [PR #334](https://github.com/Lilstanie/AI_TRIP_PLANNER/pull/334)
  [revision owner](../../../apps/web/components/trip/plan-revision.ts),
  [ownership decision](../../notes/implemented/feature/2026-10-09-plan-revision-owner.md),
  [stale-work correction](../../notes/implemented/architecture/2026-10-10-map-fallback-review-fixes.md),
  [PR #258](https://github.com/Lilstanie/AI_TRIP_PLANNER/pull/258),
  [PR #278](https://github.com/Lilstanie/AI_TRIP_PLANNER/pull/278)
- **Specific errors precede broad handlers.** `MapProviderUnavailableError` extends `NoticeError`:
  details/photo failures must return 503 before the generic authored missing-resource 404 branch.
  `GoogleNotConfiguredError` also returns 503, but retries cannot repair missing deployment config.
  Exclude `GoogleRequestError` from the generic Notice branch so its upstream status is retained:
  resource 400/404 becomes 404, 429 stays 429, other upstream failures become 502. Search has no
  missing-resource branch. Inspect status and keyed failure body together through
  [placeErrorResponse](../../../apps/web/lib/map-provider/place-error-response.ts), not only the
  displayed sentence. When changing this boundary, enumerate failures first and verify the affected
  API responses; a successful place lookup cannot prove error classification.
  [accepted error mapping](../../notes/implemented/simplification/2026-10-10-repository-surface-reduction.md),
  [PR #291](https://github.com/Lilstanie/AI_TRIP_PLANNER/pull/291)
- **Boundaries.** Agents reach providers only through ports; `route.ts` files stay thin adapters;
  production and test files stay at or below 1000 lines ([development.md](../../../docs/development.md)).
- **Secrets.** No key in code, fixtures, logs, docs or test output.
- **Documentation.** Affected `docs/` pages and Agent Notes change in the same PR; no frozen file is
  touched (`pnpm verify:protected`).
- **Licence and notice files.** A new or changed `LICENSE`, `NOTICE` or `THIRD_PARTY_NOTICES` file agrees
  with every existing notice (`git ls-files '*NOTICE*' '*LICENSE*'`); ported code is listed in each.

## Evidence

A review claim about behaviour needs evidence: a failing test, a reproduced request, or a quoted line.
For UI changes, ask for the evidence described in [ui-verification](../ui-verification/SKILL.md).
