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

It counts what happened on the branch since any skill last changed and reports a review as due when
any count reaches its threshold, or when a skill names a path or command that no longer exists:

| Signal                                                                                                                                                      | Default | Flag            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | --------------- |
| Merged pull requests (squash commits ending in `(#N)`)                                                                                                      | 8       | `--prs`         |
| Issues closed                                                                                                                                               | 5       | `--issues`      |
| Pull requests closed without merging (a rejected or redone change)                                                                                          | 2       | `--unmerged`    |
| Commits on convention files (AGENTS.md, development and team-workflow docs, CI, verify scripts, root `package.json`, Prettier, TypeScript and Turbo config) | 1       | `--conventions` |
| Commits that add, supersede or archive an Agent Note                                                                                                        | 2       | `--notes`       |

Issue and pull request counts come from the GitHub API through `curl`; when it is unreachable they
print as unavailable and the git signals still decide. Any skill change resets every count, so run it
on the latest `main`. When nothing is due, stop here.

## 1. Run the drift report

```bash
git fetch --unshallow origin 2>/dev/null || git fetch origin main
node .agents/skills/skill-maintenance/scripts/check-skills.mjs          # all skills
node .agents/skills/skill-maintenance/scripts/check-skills.mjs code-review --json
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

The script cannot see review lessons. List pull requests merged or closed since the newest skill
change, and read the closing comments and review threads of any that were closed unmerged, redone, or
needed fix-up commits. Look for three things:

- a rule a reviewer enforced that no skill states (add it to `code-review` or the owning skill, with
  the pull request as its source, as the existing bullets do);
- the same multi-step chore repeated across two or more pull requests with no skill (propose a new
  skill; [stage1-submission](../stage1-submission/SKILL.md) came from #134, #140, #142 and #152);
- an implemented Agent Note that supersedes a step a skill still teaches.

## 3. Change the skills

- Keep each skill's facts in the document or note that owns them, and link to it.
- A new skill goes in the skill table in [development.md](../../../docs/development.md#agent-workflows)
  and its Chinese pair; follow [translate-docs](../translate-docs/SKILL.md).
- Run `pnpm verify:docs`, `pnpm verify:pairs`, `pnpm verify:protected`, Prettier on the changed files,
  and the drift report again until it prints no missing path or broken command.
- Open one draft pull request on a `docs/<short-name>` branch, and add a
  [session log](../session-log/SKILL.md). If nothing needs changing, say so and open nothing.
