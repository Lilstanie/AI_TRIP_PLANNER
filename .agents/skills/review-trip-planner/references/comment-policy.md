# Task-scoped comment check

Use this check when the originating task prohibits new code comments. The scope is an explicit list
of JavaScript or TypeScript files, including JSX. It is not a repository-wide comment policy.

## Failure inventory and public seam

Validate through the CLI in a disposable Git repository before implementing the checker:

- Newly added line, block, JSX and template-expression comments escape detection.
- Staged, unstaged or untracked changes are omitted from the selected scope.
- A path removed from the index and recreated in the working tree is mistaken for a tracked deletion.
- Existing unchanged comments or comment-like strings, regular expressions, template text and JSX text
  are reported as comments.
- JSX text beginning with `/*` or `//` is scanned as a comment while real expression comments are lost.
- A changed line inside an existing multiline comment escapes detection.
- Unrelated files are scanned even though the task did not select them.
- An exception silently exempts every comment, or has no recorded justification.
- An invalid base, missing path, unsupported file or malformed syntax silently passes.
- A check mutates the worktree or index, or leaves no repeatable evidence.

The public seam is the command's exit status and JSON report. The acceptance journey is
`node apps/web/tests/cli-e2e/review-comment-policy.e2e.mjs`; it retains fixtures, invocations and
results under `output/e2e/review-comment-policy/`.

## Usage

From the repository root, supply the comparison commit and repeat `--path` for each selected file:

```bash
node .agents/skills/review-trip-planner/scripts/check-added-comments.mjs --base HEAD --path apps/web/lib/example.ts
```

The checker compares the base with the current working tree, including staged and unstaged edits.
Explicitly selected untracked files are entirely new. Deleted files have no added comments. Paths
are literal repository-relative files; directories, globs and symlinks are rejected. Supported
extensions are `.js`, `.jsx`, `.mjs`, `.cjs`, `.ts`, `.tsx`, `.mts` and `.cts`.

A file recreated after a staged deletion is untracked in the current index and is checked in full,
even if it existed at the base. JSX text is excluded using its parsed source spans; comments inside
JSX expressions remain subject to the gate.

Unchanged comment text is matched by occurrence count within each file against the base, so editing
code beside an existing inline comment does not flag it. Moving that same comment within the file
preserves it; adding another copy or changing its text counts as new.

Exit 0 means no unapproved added comments, 1 means violations, and 2 means invalid input or an
unreadable/unparseable scope. The JSON report records the resolved base, current HEAD, scope and
comment locations. HEAD identifies the commit only; uncommitted contents still need the review diff.

When the task permits a licence header or tool directive, pass `--exceptions <json-file>`. The file
contains an array of `{ "file": "path.ts", "text": "exact comment including delimiters", "reason": "task-approved justification" }`.
Each exception matches one complete comment text in one selected file. There are no implicit
licence/directive exemptions. Review exceptions together with the originating requirement.

This is a local workflow gate invoked by [review-trip-planner](../SKILL.md), not a new CI job.
It uses the repository's installed TypeScript parser and Git; it writes no files.
