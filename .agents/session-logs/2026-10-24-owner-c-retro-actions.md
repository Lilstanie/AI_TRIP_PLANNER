---
date: 2026-10-24
author: Claude (owner-c retro thread)
branch: docs/retro-owner-c-2026-10-24
pr: none
area: .github, .agents/skills
contract-impact: none
---

# Act on the owner-c delivery retro: CI timeout and review rule

## What changed

- `.github/workflows/ci.yml`: the Chromium install in `cli-acceptance-workers` now has a 10-minute
  step timeout and up to three bounded attempts, like the existing `lsof` step.
- `.agents/skills/review-trip-planner/SKILL.md`: a repository check for behaviour changes covered
  only by unit tests, with the retro as its source.

## Why

Five PRs in one batch each waited on the worker shards. The retro
(`/mnt/project-files/retro/2026-10-24-tp-owner-c-retro.md`) records one shard that ran about ten
minutes. The install step was the only unbounded `apt-get` path I could see. Its exact share of the
delay was not confirmed from logs, so this is a bound on the step, not a verified root cause.

## Validation

Recorded in the PR Evidence section.

## Notes for the next person

Skill changes for `trip-planner-pr-delivery` are not in this PR. That skill is a read-only synced
copy and was proposed as a replacement SKILL.md instead.
