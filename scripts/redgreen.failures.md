# Red/green E2E proof failure inventory

`node scripts/redgreen.mjs <e2e-name> [--prod] -- <source-path>...` runs one E2E script with the named
source paths at their `origin/main` version (before), then with the working tree (after). These
failures must be observable:

- No E2E name, no `--` separator, or no source path: usage error, exit 2, nothing run.
- A source path is the E2E script itself, so "before" would also drop the new check.
- A source path equals its base version, so before and after test the same code.
- A source path is new on the branch: "before" must remove it, not keep it.
- A path is not in the base ref and not in the working tree (a typo).
- The run throws, is interrupted (SIGINT/SIGTERM) or the E2E command is missing: the working-tree
  content of every path must be restored exactly, including files that did not exist on the base.
- "Before" passes: the check does not expose the bug; report it and exit 1.
- "After" fails: report it and exit 1.
- The E2E prints `ok`/`FAIL` lines but exits 0 with a `FAIL` line, or exits 1 with no `FAIL` line:
  both the exit code and the counts are reported, and a run counts as passed only with exit 0 and no
  `FAIL`.
- The summary must name the base ref, each run's exit code and its ok/total counts, so it can be
  pasted into a pull request's Evidence section.

The self-check drives the CLI against a temporary Git repository with `REDGREEN_RUN` set to a fake E2E
command; it proves the stash-and-restore logic only, not any browser behaviour.
