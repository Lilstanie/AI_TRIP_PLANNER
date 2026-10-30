# Worktree clean-up failure inventory

`node scripts/worktrees.mjs [--apply] [--sizes] [--worktree <path>]... [--idle-hours <n>] [--root <dir>]... [--trash <dir>]` lists the
repository's worktrees and leftovers by category, and with `--apply` moves the safe ones to the Trash.
These failures must be observable:

- An unknown argument, a value flag without a value, or a non-numeric `--idle-hours`: usage error,
  exit 2, nothing moved.
- The command runs outside a Git repository: exit 1, nothing moved.
- A run without `--apply` moves, prunes or deletes something.
- A worktree with a modified tracked file, a staged-only change or an untracked file is moved; it must
  be kept and reported as holding work.
- A clean worktree is removed with `git worktree remove --force`, `rm` or any permanent delete instead of
  a move into the Trash, so it cannot be recovered.
- Removing a clean worktree deletes its branch, or leaves a stale registry entry behind.
- A clean detached worktree whose commit is on no branch or remote ref is moved, losing that commit.
- A locked worktree, the main worktree or the worktree the command runs from is moved.
- Another agent's session is still using a clean worktree or clone: a scan without `--worktree` must
  keep anything whose Git index, `HEAD` or reflog changed within `--idle-hours` (default 24).
- `--worktree <path>` touches anything other than the named worktrees and their build output, or moves
  a named path that is not a registered worktree of this repository.
- A registry entry whose directory is already gone stays registered after `--apply`.
- A build directory (`.next`, `.turbo`, under the root or `apps/web/`) is moved from the main worktree,
  or moved while it holds tracked files.
- A directory under a scan root that holds only the agent's worktree-name marker (and `.DS_Store`)
  survives `--apply`; a directory that holds anything else is moved as marker-only.
- Moving a worktree leaves its parent holding only the marker.
- An unregistered clone of the same `origin` is moved while it has changes, a stash, or commits that no
  remote ref holds; a clone of a different repository is touched at all.
- A move overwrites an existing entry in the Trash.
- A move across file systems falls back to copying and deleting; it must be reported and kept.
- The report lists files one by one or runs a whole-tree size scan without `--sizes`; it must group by
  category with counts, and size only the candidates when asked.

The self-check drives the CLI against temporary Git repositories, a temporary scan root and a temporary
Trash directory.
