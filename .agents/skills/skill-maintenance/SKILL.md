---
name: skill-maintenance
description: Find and fix project skills in AI_TRIP_PLANNER that have fallen behind the code or the team's pull request history, using a drift report script plus a review of recent pull requests. Use when asked to check or update skills, after a refactor that renames files or commands, or when the scheduled due check reports that a review is due.
---

# Keep the skills current

A skill that names a moved file, a renamed command or a superseded rule is worse than no skill: an
agent follows it confidently. This workflow finds those skills and updates them in one pull request.

## 0. Decide whether a review is due

```bash
node .agents/skills/skill-maintenance/scripts/is-due.mjs    # exit 10 when due, 0 when not
```

It counts activity after the explicitly reviewed revision in a committed full-review checkpoint.
Helper edits and partial skill corrections never advance that revision. A review is due when
any count reaches its threshold, or when a skill names a path or command that no longer exists:

| Signal                                                                                                                                                      | Default | Flag            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | --------------- |
| Merged pull requests (squash commits ending in `(#N)` or `Merge pull request #N` commits)                                                                   | 8       | `--prs`         |
| Issues closed                                                                                                                                               | 5       | `--issues`      |
| Pull requests closed without merging (a rejected or redone change)                                                                                          | 2       | `--unmerged`    |
| Commits on convention files (AGENTS.md, development and team-workflow docs, CI, verify scripts, root `package.json`, Prettier, TypeScript and Turbo config) | 1       | `--conventions` |
| Commits that add, supersede or archive an implemented Agent Note                                                                                            | 2       | `--notes`       |

Issue and closed-unmerged pull request counts come from the GitHub API through `curl`. Transport,
HTTP, malformed JSON, invalid response shapes, repeated pagination or missing PR merge details print
as unavailable (JSON signals are `null`). Measured zero stays an empty array. Pagination continues
until a short page; a PR without a merge marker in the Issues response is checked through the PR
endpoint. If only PR details fail, the measured closed-Issue count remains available. Rejected
proposals do not count as implemented Agent Notes. Local Git signals remain usable during remote
failures. A not-due result with unavailable signals is incomplete
evidence: report the gap and repeat when GitHub is available.

Missing, invalid, incomplete or unreachable checkpoints and shallow history conservatively require a
review (exit 10). The tool never substitutes the latest skill edit. With no accepted checkpoint it
reports available Git activity across the available history, and requests closed GitHub activity
without a date cutoff. Failed Git counts are unavailable, not zero. Fetch complete history and repair
the record before interpreting exact counts. Broken paths or commands independently make review due;
an unavailable drift command also requires review. Run on the intended integration branch or latest
`main`. When nothing is due and evidence is available, stop here.

## 1. Run the drift report

```bash
git fetch --unshallow origin 2>/dev/null || git fetch origin main
node .agents/skills/skill-maintenance/scripts/check-skills.mjs          # all skills
node .agents/skills/skill-maintenance/scripts/check-skills.mjs review-trip-planner --json
```

The script reads every `SKILL.md` and reports:

- **missing path:** a backticked file or folder that no longer exists. Always fix it.
- **broken command:** a `pnpm` script or `--filter` package that no longer exists. Always fix it.
- **changed since:** commits on files the skill names, after the skill last changed, with the files
  that matched (`via`). These are prompts, not errors. Read each diff (`git show <hash> -- <file>`)
  and change the skill only when a rule, path, command or threshold it states is now wrong.

It exits 1 on a missing path or broken command, and 0 when only drift is reported. Placeholders
(`packages/<pkg>/src/**`), identifiers (`process.env`) and bare folder names (`output/`) are ignored.

## 2. Read the recent pull requests

The script cannot see review lessons. List pull requests merged or closed since the reviewed
revision, and read the closing comments and review threads of any that were closed unmerged, redone, or
needed fix-up commits. Look for three things:

- a rule a reviewer enforced that no skill states (add it to `review-trip-planner` or the owning skill, with
  the pull request as its source, as the existing bullets do);
- the same multi-step chore repeated across two or more pull requests with no skill (propose a new
  skill; the retired `stage1-submission` skill came from #134, #140, #142 and #152);
- an implemented Agent Note that supersedes a step a skill still teaches.

## 3. Change the skills

- Keep each skill's facts in the document or note that owns them, and link to it.
- A new skill goes in the skill table in [development.md](../../../docs/development.md#agent-workflows)
  and its Chinese pair; follow [translate-docs](../translate-docs/SKILL.md).
- Run `pnpm verify:docs`, `pnpm verify:pairs`, `pnpm verify:protected`, Prettier on the changed files,
  and the drift report again until it prints no missing path or broken command.
- Open one draft pull request on a `docs/<short-name>` branch, and add a
  [session log](../session-log/SKILL.md). If nothing needs changing, say so and open nothing.

## 4. Record a completed full review

Only after reviewing **every current project skill**, record the outcome at
.agents/skills/skill-maintenance/assets/review-checkpoint.json and commit it. Partial corrections and tool
acceptance runs do not establish a completed review. Do not create this record merely to clear a
reminder. Inspect accepted merged outcomes, unresolved Issues, closed-unmerged alternatives, comments
and review threads; a closed PR alone is not an implemented decision.

The JSON record uses this schema (the revision and entries below are placeholders):

```json
{
  "version": 1,
  "reviewedRevision": "<full 40-character Git commit SHA actually reviewed>",
  "skills": [
    {
      "name": "<one entry for every project skill directory>",
      "summary": "What was checked, its accepted outcome, and any remaining boundary."
    }
  ],
  "reviewedIssues": [
    {
      "number": 300,
      "reason": "Explain the substantive review and which guidance covers this Issue.",
      "evidence": ["<repository-relative committed review evidence path>"]
    }
  ]
}
```

The reviewed revision must be reachable from the record commit and `HEAD`, with complete Git history.
Coverage must match exactly the skill entrypoints at that revision and at `HEAD`, without duplicates.
Every summary and Issue rationale needs at least 20 characters after trimming surrounding whitespace.
This is a format guard, so a maintainer must still inspect its meaning. Use an empty `reviewedIssues` array when no
exclusions are justified. Each explicit exclusion needs committed evidence paths available at the
record commit; bare Issue references in commit messages are never exclusions. Exclusions apply only
to closures through the record commit time; an Issue reclosed later counts again. PRs are not excluded
by Issue coverage. Activity after the reviewed revision remains counted even when it precedes the
record commit. Uncommitted checkpoint edits are ignored.

A new skill invalidates old coverage until a full review includes it; ordinary changes within existing
skills keep the prior checkpoint. The CLI is read-only and reports checkpoint validity in its JSON
alongside the existing baseline, thresholds, signals and reasons. It keeps exit 10 for due and 0 for
not due; `check-skills.mjs` keeps exit 1 for broken references and 0 for drift prompts only. Drift
prompts still use each skill's last edit and are advisory; they do not establish the global review.

Run the isolated public CLI acceptance directly:

```bash
node apps/web/tests/cli-e2e/skill-maintenance.e2e.mjs
```

It creates fixture repositories, stubbed GitHub responses and a retained summary under the system
temporary directory, printing its location. Each result records arguments, revision history, exit
status, stdout and stderr, including failed runs. It never records a completed review in this checkout.
The [checkpoint decision](../../notes/implemented/process/2026-10-12-skill-review-checkpoint.md)
explains the boundary.
