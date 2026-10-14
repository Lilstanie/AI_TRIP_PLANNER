---
date: 2026-10-14
author: Claude
branch: chore/ignore-local-output
pr: none
area: .gitignore, scripts, docs
contract-impact: none
---

# Ignore the local scratch and evidence directories, and add a command to delete them

## Failure inventory (written before the script)

`scripts/clean-output.mjs` deletes four fixed directories. It can go wrong when:

1. A target does not exist: must report it and exit 0.
2. A target is a symlink: must remove the link only, never follow it.
3. A target holds a tracked file: must refuse and name the file, deleting nothing.
4. It runs from another working directory or a worktree: the root comes from the script's own
   location, never from the current directory.
5. A removal fails part way: must report each failure and exit non-zero.
6. Git cannot list tracked files: must refuse, since tracked content cannot be ruled out.
7. A caller names a path: arguments never choose what is deleted; only `--dry-run` is accepted.
8. A user wants to see first: `--dry-run` lists sizes and deletes nothing.

## What changed

- `.gitignore`: `/output/`, `apps/web/output/`, `/tmp/` and `/.scratch/` replace three narrower entries.
- `scripts/clean-output.mjs` and `pnpm clean:output`: delete those four directories.
- `AGENTS.md`: rule 5 of the delivery workflow runs it once the pull request is open.
- `docs/development.md` and `.zh.md`: name the ignored directories and the command.

## Validation

See the pull request description.

## Notes for the next person

Ignoring deletes nothing. CI evidence archiving reads `output/e2e/` and `output/playwright/` from the
filesystem, so it is unaffected.
