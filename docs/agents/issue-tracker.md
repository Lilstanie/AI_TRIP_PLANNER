# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v`; `gh` does this automatically when run inside a clone.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

When set to `yes`, PRs run through the same labels and states as issues, using the `gh pr` equivalents:

- **Read a PR**: `gh pr view <number> --comments` and `gh pr diff <number>` for the diff.
- **List external PRs for triage**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments` then keep only `authorAssociation` of `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, or `NONE` (drop `OWNER`/`MEMBER`/`COLLABORATOR`).
- **Comment / label / close**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub shares one number space across issues and PRs, so a bare `#42` may be either: resolve with `gh pr view 42` and fall back to `gh issue view 42`.

## Issue templates

Contributors file reports through the forms in `.github/ISSUE_TEMPLATE/`: `bug.yml` (labels `bug` and
`needs-triage`), `ui-improvement.yml` and `idea.yml` (labels `enhancement` and `needs-triage`; ideas also
get the `[idea]` title prefix). A form applies its labels whatever the reporter's permission, so reporters
without triage access never add labels by hand. Only maintainers add `ready-for-agent`, `ready-for-human`
or `wontfix`.

Every form asks for a **User goal** ("As a … I want … so that …") and **Acceptance criteria**, the two parts
of a Jira story, and has an optional **Jira key** field. The reporter leaves the key blank; at triage the
maintainer creates the story from those two fields, fills in the key and puts it at the start of the title.

## Writing a ticket

- **Protected files.** A ticket whose change reaches a protected path (`packages/shared/src`, `.github/**`,
  root `package.json` or another root config file listed in `AGENTS.md`) carries a `Protected files:` line
  naming them. Whoever implements a batch of tickets collects these lines into one question to the user
  before work starts, since approval written only in an issue does not count.
- **Shared contracts.** Any change under `packages/shared/src`, including one new export, needs an Agent Note
  and `contract-impact: packages/shared` in the session log (`pnpm verify:protected` enforces it). A ticket
  never says otherwise.
- **Closing.** The pull request that finishes a ticket says `Closes #<number>`, so merging it closes the
  ticket.

## Jira

The team tracks sprints in Jira project `TP` (<https://headmastereggy.atlassian.net/jira/software/projects/TP/boards/4/backlog>).
Jira only sees issue keys such as `TP-16` that appear in text, so every link is made by writing the key.

- **One story per ticket.** Each GitHub ticket gets a Jira story under the epic for its area. The story's
  summary states the traveller's goal; its description is one paragraph, an `Acceptance criteria:` list, a
  `GitHub:` link to the ticket and an `Owner: member <A-E>` line. Labels: `github-<number>`,
  `owner-<a-e>`, and `stage2-demo` when the demo uses it.
- **Titles.** The GitHub ticket title starts with the story key: `TP-74 Trajectory record inspector`. A spec that only groups tickets needs no story.
- **Branches.** The key follows the prefix: `feature/TP-72-trajectory-tab`, `docs/TP-72-trajectory-glossary`.
- **Pull requests.** The PR title starts with the key and the template's `Jira:` line repeats it. Commit
  messages may carry it too; smart-commit commands such as `#done` are not used.
- **What Jira shows.** The GitHub for Jira app syncs branches, commits, pull requests, builds and
  deployments whose text carries the key; they appear in the story's Development panel. GitHub issues are
  not synced, so a key in an issue title only helps people match the two by hand.
- **Status.** Two Jira Automation rules in project `TP` move the story from its linked pull request, so
  nobody moves it by hand. They act on every story whose key appears in the PR title, branch or commits.

### Automation rules

Create both under **Project settings → Automation → Create rule** in project `TP`; a project admin
creates them once.

| Rule                 | Trigger              | Condition                            | Actions                                                                                   |
| -------------------- | -------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------- |
| `PR opened → 进行中` | Pull request created | Issue fields: Status is `待办`       | Transition issue to `正在进行`                                                            |
| `PR merged → 完成`   | Pull request merged  | Issue fields: Status is not `已完成` | Transition issue to `已完成`; comment `Merged: {{pullRequest.title}} {{pullRequest.url}}` |

Turn each rule on after saving. A rule that did not fire shows the reason under **Automation → Audit
log**; whoever merges then moves the story by hand and checks the log.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `gh issue create --label wayfinder:map`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (`gh api` on the sub-issues endpoint). Where sub-issues aren't enabled, add the child to a task list in the map body and put `Part of #<map>` at the top of the child body. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: GitHub's **native issue dependencies**, the canonical, UI-visible representation. Add an edge with `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric **database id** (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`, _not_ the `#number` or `node_id`). GitHub reports `issue_dependencies_summary.blocked_by` (open blockers only, the live gate). Where dependencies aren't available, fall back to a `Blocked by: #<n>, #<n>` line at the top of the child body. A ticket is unblocked when every blocker is closed.
- **Frontier query**: list the map's open children (`gh issue list --state open`, scoped to the map's sub-issues / task list), drop any with an open blocker (`issue_dependencies_summary.blocked_by > 0`, or an open issue in the `Blocked by` line) or an assignee; first in map order wins.
- **Claim**: `gh issue edit <n> --add-assignee @me`, the session's first write.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`, then append a context pointer (gist + link) to the map's Decisions-so-far.
