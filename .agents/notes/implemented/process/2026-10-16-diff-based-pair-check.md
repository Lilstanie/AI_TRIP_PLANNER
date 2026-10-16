# Agent Note: the pair check compares a change with its base instead of stored hashes

Status: implemented
Owner: A (@Lilstanie)

## Problem

`check-pairs.mjs` required a SHA-256 for both files of every documentation pair in
`.agents/translation-pairs.json`, refreshed with `--record` after a review. Any two branches that
edited the same page wrote different hashes to the same lines, so the record conflicted on every
merge, and resolving it meant re-recording and rerunning CI. In one run, four of six parallel pull
requests conflicted on the `docs/workspace-ui.md` entry alone. Splitting the record into one file per
pair would not have helped: all four edited the same pair.

## Decision

`.agents/skills/translate-docs/scripts/check-pairs.mjs` stores nothing. It keeps the structural
comparison (headings, lists, tables, fences, inline code, links and heading anchors) and the missing
and orphan pair checks. It adds a diff rule against `--base` (default `origin/main`), from
`git merge-base <base> HEAD` to the working tree: when an English page changed beyond whitespace
(`git diff --ignore-all-space`), its `.zh.md` counterpart must also change. A Chinese-only change
passes, and changes that arrived from the base are not counted. When the base does not resolve, the
check warns and runs the structural comparison only. `.agents/translation-pairs.json` and the
`--record` and `--remove` modes are removed; passing either mode fails with a message saying so. CI
keeps running the same command in the `protected-files` job, whose checkout has the base branch.

This partly supersedes the [bilingual documentation note](2026-09-26-bilingual-docs-agent-experience.md):
its hash record is replaced, and its other decisions stand.

## Alternatives considered

**One record file per pair.** Removes conflicts between different pairs, but not between branches
that edit the same page, which was the case that cost the most.

**A git merge driver that re-records on conflict.** Runs only in local merges; GitHub's conflict
check and web merges ignore custom drivers, so pull requests would still show conflicts.

## Consequences

- Parallel documentation changes no longer conflict over a record, and no step refreshes hashes.
- The check is weaker as evidence: touching the Chinese file satisfies it whether or not the
  translation was reviewed. The old record was also self-attested, so semantic review before pushing
  stays a workflow rule in the translate-docs skill, not something the check proves.
- A Chinese page left stale by an edit that predates the base is no longer caught; only changes
  after the merge-base are compared.

## Sources

- Retro of the 2026-10-16 batch (#410 to #417).
- [2026-10-16 diff-based pair check log](../../../session-logs/2026-10-16-diff-based-pair-check.md)
