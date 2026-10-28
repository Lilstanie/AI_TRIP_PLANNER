---
name: "trip-planner-pr-delivery"
description: "Deliver an AI_TRIP_PLANNER change as a pull request and drive it to a squash merge: branch, checks, PR body, assign, watch CI, merge, clean up. Use when delivering a change in AI_TRIP_PLANNER as a pull request, or driving an open one to green."
---

# AI_TRIP_PLANNER PR delivery

The repeatable loop for Lilstanie/AI_TRIP_PLANNER. Each step ends on its stated **done** condition. Below, `R=repos/Lilstanie/AI_TRIP_PLANNER`.

Rules come from `origin/main`: checking out an older PR branch also swaps in that branch's `AGENTS.md`/`CLAUDE.md`. When they disagree, read `git show origin/main:AGENTS.md`.

## 0. Jira story

The team tracks sprints in Jira project `TP` (https://headmastereggy.atlassian.net/jira/software/projects/TP/boards/4/backlog). Jira links only keys written in text, so every ticket, branch and PR carries its `TP-<n>` key. The full convention is in `docs/agents/issue-tracker.md` § Jira.

- Find the ticket's story: its GitHub title starts with `TP-<n>`, or search Jira for the `github-<issue number>` label. With none, create one with the Atlassian connector (`createJiraIssue`, cloudId from `getAccessibleAtlassianResources`): issue type `故事`, parent = the area's epic (e.g. TP-3 planning loop), priority High, labels `github-<n>`, `owner-<a-e>` (Joey is member C) and `stage2-demo` when the demo uses it, story points in `customfield_10016`. Summary states the traveller's goal; description is one paragraph, `Acceptance criteria:` bullets, `GitHub: <issue url>` and `Owner: member <X>`.
- Jira people fields:
  - **Reporter** is the person who created the story. When Joey creates a story, Joey is the reporter. If a session creates it on his behalf and the reporter comes out as someone else, set the reporter to Joey.
  - **Assignee** (经办人) is the person who completes the story. When Joey completes a story, Joey is the assignee. Set it on creation and again when the PR merges, if it is empty or someone else.
  - Leave stories that other people created and completed as they are.
- Set the assignee to Joey when you create the story, not only at merge (`editJiraIssue` `fields`, `{"assignee": {"accountId": "<id>"}}`); a story created by `createJiraIssue` starts with no assignee.
- Then prefix the GitHub ticket title with the key.
- Call shapes that work with the connector: `transitionJiraIssue` takes a top-level `transitionId` (Done is `31`), not a `transition` object. `addOrEditJiraIssueComment` takes `commentBody`, not `body`. `editJiraIssue` takes `fields`, for example `{"assignee": {"accountId": "<id>"}}`.
- Jira list, search, transition and edit calls return the whole story by default. Pass `responseFields` (for example `summary`, `status`, `labels`), and fetch `description` for one key at a time, or the call can exceed the token limit. Do the same for GitHub: `list_issues` and `issue_read` take `minimal_output`.
- The cloud container cannot reach atlassian.net directly (proxy 403); use the connector. Without it, ask the user to connect Atlassian MCP.
- Do not use smart-commit commands (`#done`). No Jira Automation rule moves a story to 完成 when a PR merges, so the story is moved by hand (step 6).

Done: the story exists, its reporter and assignee are right, and the GitHub ticket title starts with its key.

## 1. Branch

Branch from a freshly fetched `origin/main` as `feature/`, `fix/`, `refactor/`, `docs/`, `test/` or `chore/` followed by the key and a short name (`feature/TP-72-trajectory-tab`), never a name holding an AI tool name, even when the harness assigns `claude/...`.

Work each PR in its own worktree, so uncommitted edits cannot carry over from another branch: `git fetch origin main && git worktree add -b <branch> ../<dir> origin/main`. Do not run `git checkout -b` in a tree that holds another branch's uncommitted changes. Stashing and popping to fix that is how edits end up on the wrong branch.

Done: `git rev-parse --abbrev-ref HEAD` shows the standard name with the key, in a worktree that holds only this PR's changes.

## 2. Look for an existing PR

Run the PR search from `pre-push-checks` §1 for the issue number. If an open or merged PR already covers it, continue that one.
Done: no duplicate PR exists, or you are working on the existing one.

## 3. Change and prove it

- Write the failure modes first (a `*.failures.md` next to the E2E), then the E2E.
- Prove red then green with `DATA_MODE=mock node scripts/redgreen.mjs <e2e> -- <source paths>`; quote its before/after counts.
- A behaviour change under `packages/*/src` or `apps/web/lib` with only Vitest tests needs either a redgreen record or a stated reason no E2E can cover it, in the PR Evidence section. The repository's CLAUDE.md prefers E2E tests as the sole mechanism.
- Run what `pre-push-checks` selects: `pnpm verify:docs`, `pnpm verify:pairs`, `pnpm verify:protected`, `pnpm verify:e2e-selectors`, `pnpm verify:e2e-artifacts` (root scripts, not `--filter`), Prettier on the changed files, and the package tests/typecheck/lint the diff touches.
- `verify:pairs` compares inline code between a doc and its `.zh.md`: Prettier can wrap a long inline-code span in one file and not the other, so keep inline-code examples short.
- Comment policy: commit first, then `pnpm check:comments` (CI's `added-comments` job runs the same check against the merge base; a comment it flags fails the PR).
- Add a session log (`session-log` skill) and update en + zh docs. A `packages/shared/src` change also needs an Agent Note and `contract-impact: packages/shared`.
- Start commit messages with the key (`TP-72 docs: ...`).
  Done: every selected command was run and its real result is written down.

## 4. Open the PR

- Title starts with the key: `TP-72 feat(chat): ...`.
- Commit trailer and PR footer: the attribution lines the session gives.
- Body: a PR closes an issue only through a keyword written once per issue (`Closes #743, Closes #744`); `Closes #743, #744` closes only the first. Start with the project-attribution comment and requester line when working in a project thread, then the template's `**Jira:** TP-<n>` line, then the sections Summary, Evidence, Merge Danger.
- Create it as a draft with `gh api $R/pulls -F draft=true -F body=@<file>` (or MCP `create_pull_request` with `draft: true`). The MCP create call does not set assignees. Set them with MCP `issue_write`, method `update`, `issue_number` and `assignees: ["HeadmasterEggy"]`. `update_pull_request` does not take assignees.
- Then `subscribe_pr_activity` with `owner`, `repo` and `pullNumber`.
- Run `pnpm clean:output` once the evidence is quoted.
  Done: draft PR exists, titled with the key, assigned and watched.

## 5. Drive to green

Status of one or more PRs in one line each:

```sh
for n in <PRs>; do sha=$(gh api $R/pulls/$n --jq .head.sha); echo "#$n ${sha:0:7} $(gh api $R/pulls/$n --jq .mergeable_state) bad=[$(gh api "$R/commits/$sha/check-runs?per_page=50" --jq '[.check_runs[]|select(.conclusion!="success")|"\(.name):\(.conclusion // .status)"]|join(",")')]"; done
```

If `gh` is unavailable, use MCP `pull_request_read` with `get` and `get_check_runs`. Judge mergeability from `mergeable_state`, not from `base.sha`, which keeps the old base after main moves.

`unknown` right after a push means GitHub is still computing; ask again a few seconds later. Red means fix and push; end the turn while it runs, since events wake the session.

A failure event can name a commit that is no longer the PR head. Before acting on it, compare the event's `head_sha` with the current head (`get`). If the head has moved, the failure is superseded: no fix, no comment. Check the current head's runs instead.

Job logs: `gh api $R/actions/jobs/<id>/logs` is refused (403 on the blob redirect). Use the MCP tool `get_job_logs` with `job_id`, `return_content: true`, `tail_lines: 60`.

A `cli-acceptance-workers` job that times out inside a setup step, or fails with "Artifact not found ... cli-acceptance-plan", before any test ran is infrastructure, not your diff. Re-running only the failed job does not recover it. Merge `origin/main` into the branch and push to start a fresh run, and say so once on the PR.

`dirty` means a conflict with main: merge `origin/main`, resolve, re-run the checks the conflicted files select, push. Never rewrite history on a branch you did not create.
Done: every check `success`, `mergeable_state` is `clean`.

## 6. Merge and clean up

- Merge PRs you opened in this session, or ones the user named, when green and nothing awaits the user's decision; protected files need the user's OK first. Another person's PR (a teammate's, or one saying "No merge is requested") needs the user's explicit OK for that batch.
- Mark ready with `gh api -X POST $R/pulls/<n>/ccr/ready_for_review` (GraphQL is blocked; MCP `update_pull_request` with `draft: false` also works), then `gh api -X PUT $R/pulls/<n>/merge -f merge_method=squash -f sha=<head sha>`.
- After the merge, list the issues the PR was meant to close and close any still open (`issue_write`, `state_reason: completed`).
- Delete the local branch and its worktree after merge. The cloud container cannot delete remote branches; once the repo owner turns on auto-delete, GitHub does it.
- Jira, by hand after every merge: transition the story to 完成 with `transitionJiraIssue` (`transitionId` 31), add one comment naming the merged PR with `addOrEditJiraIssueComment`, and check that the assignee is right (step 0). No Automation rule does this for us.
- Tell the user in one line, with the PR link.
  Done: PR merged, linked issue closed, Jira story 完成 with the right assignee, user told.

### Reviewer requests

When the PR author is the user (Joey), skip the reviewer request. GitHub refuses it with "Review cannot be requested from pull request author", and the refusal is not a blocker.

### Several PRs in one batch

PRs that touch the same files conflict with each other, not only with main.

1. Before opening a batch, list the files each PR touches. Order the PRs so each shared file is changed by one PR first.
2. After each merge, re-read `mergeable_state` for the rest. Any that turn `dirty`: merge `origin/main` into their branch and push, then wait for a fresh green run.
3. When a conflict is two added test blocks, keep both blocks. Do not pick one side.

### Stacked PRs

A PR whose base is another PR's branch still carries that base's original commits after the base is squash-merged, so every line the base touched conflicts.

1. Before asking to merge a stack, test it together: on a scratch branch from `origin/main`, merge each PR head bottom-up, then run typecheck, tests, lint and the docs checks.
2. Merge bottom-up. After the base merges, retarget: `gh api -X PATCH $R/pulls/<n> -f base=main`.
3. Merge main into the upper branch with `git merge -X ours origin/main` when the branch's text should win the conflicting hunks; non-conflicting changes from main still arrive. Never `git checkout --ours <file>`: it replaces the whole file and silently reverts main's other edits to it.
4. Check the result: `git diff origin/main --stat | tail -1` must match the PR's original `+additions/-deletions`. A mismatch means the resolution dropped or added content.
5. Validate, push (a merge commit, no force-push), and wait for green before the next merge.
