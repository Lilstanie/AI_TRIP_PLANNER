# Failure inventory: trip UI triage (#435 budget status)

The issue reports the ample-headroom case failing on `origin/main` `25ce9fa`; this session did not re-run the unchanged script. For a budget of estimate / 0.9 the product shows "Known estimate within budget · unpriced stops not counted" with the caution state. The script still expects "Within budget" with no caution.

That expectation is the 5% headroom rule that `8149044` (2026-10-19, session log `.agents/session-logs/2026-10-19-budget-caution.md`) removed on purpose; `docs/workspace-ui.md` documents the current rule.

- Expected now: any under-budget estimate with unpriced stops is cautioned, with no headroom threshold.
- Would hide a regression: the check still fails if the caution is dropped or the status text changes.
- Repair: the ample-headroom assertions expect the caution state (`trip-ui-triage.e2e.mjs`).
