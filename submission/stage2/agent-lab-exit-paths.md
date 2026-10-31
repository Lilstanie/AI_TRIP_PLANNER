# Agent Lab: how the planning loop stops

The planning loop detects conflicts after the specialists propose, sends only the agents involved back
for targeted revision, and stops for one of a fixed set of reasons. Each row below is one Agent Lab
run on fixture data, with no model calls and no network, so anyone can repeat it from the Canvas copy:

```bash
pnpm --filter @trip/orchestrator exec vitest run tests/agent-lab-exit-paths.e2e.test.ts
```

The test fails if any row here no longer matches a fresh run. It writes each run's full Agent Lab
artifact (events, plan, checks and metrics) and a `summary.json` to `output/e2e/TP-21/<run>/`.
Amounts are AUD.

| Exit path             | Scenario                    | Strategy                        | Fault              | Stop reason         | Rounds | Unresolved conflicts | Budget | Estimate | Within budget | All checks pass |
| --------------------- | --------------------------- | ------------------------------- | ------------------ | ------------------- | ------ | -------------------- | ------ | -------- | ------------- | --------------- |
| No conflict           | `tokyo-couple`              | `multi-agent-targeted-revision` | none               | `converged`         | 1      | 0                    | 6000   | 4000     | yes           | yes             |
| Resolved by revision  | `tokyo-couple-tight-budget` | `multi-agent-targeted-revision` | none               | `converged`         | 2      | 0                    | 2300   | 2120     | yes           | yes             |
| Stalled               | `tokyo-couple-tight-budget` | `multi-agent-targeted-revision` | `stalled-revision` | `no_improvement`    | 2      | 1                    | 2300   | 2560     | no            | no              |
| Round limit           | `tokyo-couple-tight-budget` | `multi-agent-no-revision`       | none               | `round_limit`       | 1      | 1                    | 2300   | 2560     | no            | no              |
| Infeasible            | `paris-family-infeasible`   | `multi-agent-targeted-revision` | none               | `infeasible_budget` | 1      | 1                    | 3000   | 4760     | no            | yes             |
| Single-agent baseline | `tokyo-couple-tight-budget` | `single-agent-baseline`         | none               | none                | 1      | 0                    | 2300   | 3960     | no            | no              |

## What the data shows

- On the same A$2,300 tight-budget trip, one agent planning alone overshoots by A$1,660. Five
  specialists without revision overshoot by A$260. Targeted revision brings the plan to A$2,120,
  inside the budget, in one extra round.
- When revision cannot improve the plan, the loop keeps the best plan it has and stops with
  `no_improvement` instead of looping again.
- The no-revision strategy allows one round, so its round limit is reached as soon as a conflict
  remains. The revision strategies allow three rounds in total.
- When the cheapest flights and stays found already exceed the budget, the loop stops with
  `infeasible_budget` and reports the supported minimum instead of inventing cheaper options. Its
  checks pass because a safe stop is the expected outcome.
- The single-agent baseline has no conflict check, so it reports no stop reason and no unresolved
  conflicts even though it is over budget.
