---
date: 2026-10-21
author: Codex
branch: fix/party-breakdown-review
pr: 447
area: packages/orchestrator, apps/web, docs
contract-impact: none
---

# Preserve a known traveller total when a new breakdown conflicts

## What changed

- Pass the known total into local extraction and preserve its authority in chat tool updates.
- Let brief merging discard both old and new contradictory party details.
- Add the prior-total regression to the failure inventory and API E2E; synchronize workspace UI docs.
- Integrate main through 577202a719af91d98abe2cfeeac23ab10e7c8e52.

## Validation

- Regression first failed 9/10, including an existing four-adult party; runner 2026-10-20T12-28-34-220Z.json.
- Final production patch on 8064d2f6: party-breakdown and party-breakdown-browser passed; runner 2026-10-20T12-32-03-254Z.json, API 10/10, eight browser records across English/Chinese and 1440/390px, including reopen.
- Subsequent integration changes only unrelated phone-map fixtures/docs/logs; rerun API evidence is quoted in the PR.
- Orchestrator tests: 275/275; orchestrator-dependent typecheck and orchestrator lint passed.
- Web tests: 642/642; web source unchanged by the final orchestrator correction. Existing jsdom canvas diagnostics were nonfatal.
- Docs, 27 translation pairs, protected files, selectors, 86 E2E artifact writers, formatting, scoped added-comment check and diff whitespace passed.
- Environment: Node 26.8.1, pnpm 9.15, Chrome 155, mock tools; evidence is not live-model acceptance.

## Notes for the next person

Keep groupSize authoritative; stale prior party data must disappear as well as a rejected new breakdown.
