---
date: 2026-11-01
author: Joey (HeadmasterEggy), assisted by Claude
branch: docs/stage2-demo-evidence
pr: none
area: docs, submission
contract-impact: none
---

# Stage 2 demo evidence sheet with measured figures

## What changed

- Add `docs/design/stage2/demo-evidence.md` and its `.zh.md` pair: each Stage 2 criterion mapped to
  what to show live and to figures (tests, Agent Lab budgets, Jira counts, CI time, auth and PWA checks).
- Link it from `docs/README.md`, `docs/README.zh.md` and `submission/stage2/README.md`.

## Why

The unit asks for code, the contribution form and a live demo, not a Stage 2 report; the advanced
technology criterion still wants "clear performance improvements, supported by data".

## Validation

- Figures: `git log origin/main` (795 commits, 403 squash-merged PRs), Jira JQL counts (238 issues,
  230 done, one sprint), GitHub Actions `ci.yml` pull_request runs (median 7.3 min for 29 runs before
  PR #880 merged at 08:10 UTC, 5.3 min for 29 after).

## Notes for the next person

- Jira has one sprint only, so the burn-down covers 21 to 31 October.
