# Agent Note: Code, not the model, writes the reply's cost sentence

Status: implemented

## Problem

The conversation model wrote the reply's amounts from the plan facts, and three bug-bash runs found it
contradicting the Trip budget card. It said flights were included when transport had no price
(#542). It called unpriced stops free and AUD 0 (#475). It called a total "comfortably under" the
budget while quoting an activity figure that was outside the total (#476). Prompt rules against each
wording did not stop the next variant.

## Decision

`costLine` in `packages/orchestrator/src/cost-line.ts` writes the cost sentence from the plan. It
gives the estimated total, the categories with an amount, what is not included (transport without a
price, and activity stops without `estCost`, not counting dining picks), and the exact headroom or
overrun against the budget. An infeasible plan also gets the minimum budget. The figures and their
rules are the Trip budget card's, and the sentence is written in English or Chinese to match the
reply. Every reply that comes with a new plan ends with it, whether the model or the fallback wrote
the rest. `replan_trip` hands the model the plan without amounts, and the prompt tells it not to
state totals, budget comparisons or what is included. Joey chose this on 2026-10-24.

## Alternatives considered

- Tighten the prompt rules again. Rejected: each earlier rule was followed by a new wording that
  broke the same promise.

## Consequences

- The reply and the budget card cannot disagree about the total, exclusions or headroom.
- Replies are slightly longer after small edits, because each new plan repeats the cost sentence.
- Answers about an existing plan without a replan still see amounts and can quote them.
