# Agent Note: Lock every fixed bug with a machine check

Status: implemented
Owner: C (HeadmasterEggy)

## Problem

The same bug classes kept coming back. Background writes counted as traveller edits three times
(TP-247, TP-257, TP-258); a chat follow-up opened a false "Replace your edited plan?" browser
dialog (TP-257) although the 2026-10-08 itinerary decision removed confirmations; a flight answer
printed a price without its currency code through `moneyIn` (TP-272). Each fix lived only in code
and in prose rules, so nothing stopped the next change from repeating it. tibo.dog (@poteto) turns
every fixed bug into a lint rule; the pstack principle "encode lessons in structure" says to write
the rule as a lint, type, runtime check or script instead of more text.

## Decision

A bug-fix pull request adds a machine check that fails on the old code and quotes its red output in
Evidence, or says why no check can catch the class. AGENTS.md, `docs/development.md` § Lock a fixed
bug, `trip-planner-pr-delivery` and `review-trip-planner` carry the rule. The first batch:

- `apps/web/.eslintrc.json` bans `window.confirm`, `alert` and `prompt`. Chat sends, question
  answers and resumed runs no longer ask before replacing an edited plan: the request already
  carries the edited plan. The form replan keeps its confirm as the one listed exception until it
  gets an Undo, because it discards direct edits.
- `settlePlan` takes `write: "traveller" | "background"`; only a traveller write bumps
  `editVersion`, and every caller has to choose.
- `moneyIn` is removed from `packages/shared/src/money.ts`; it had no callers after TP-272 and
  formatted amounts without the currency code. `formatMoney` remains the formatter.

## Alternatives considered

- Lint only: checked against the fix diffs, a lint rule would not have caught TP-247 (the bump was
  inside `trip-edit.ts`, which must write `editVersion`) or the Google Maps lifecycle bugs (TP-177,
  TP-212, TP-214, TP-222), so the rule accepts types, scripts and deletions too.
- Rules in AGENTS.md prose only: what the project did before; the classes above recurred anyway.
- Remove every confirm now: the form replan would silently discard direct edits with no Undo
  (Joey chose to keep that one, 2026-11-02).

## Consequences

- Bug-fix PRs carry one more piece of evidence; classes no check can catch (model wording, map
  timing) need a sentence instead.
- `packages/shared` consumers lose `moneyIn`; none existed.
- The form-replan confirm stays behind an `eslint-disable-next-line` until a replan Undo exists.
