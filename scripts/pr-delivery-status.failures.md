# PR delivery status failure inventory

Before the checker can report a pull request ready, these failures must be observable:

- `gh` is missing, fails, returns invalid JSON, or cannot find the requested pull request.
- The local checkout is detached, dirty, on another branch, or its commit differs from the PR's exact head SHA.
- The pull request is closed, merged, or targets a base other than `main`.
- GitHub reports no checks, a pending/queued/running/failed check, or an unreadable check result.
- A skipped check is unexplained. The only permitted skip is `CI / cli-acceptance-workers`, and only when the same CI run ID has successful `cli-acceptance-plan` and `cli-acceptance` checks; missing run links, cross-run evidence, other skips, or non-CI skips fail closed.
- The PR body omits or empties Summary, Evidence, or Merge Danger.
- Valid evidence wording is rejected because it does not match a lexical result phrase or an invented `Limits:` requirement.
- A fixture-based self-check is mistaken for evidence about GitHub, remote CI, or a real provider.
- A checker path invokes a mutating GitHub or Git operation such as push, merge, close, or branch deletion.

The self-check will drive the actual CLI against temporary Git repositories and a fake `gh` executable. Those fixtures verify checker behavior only; they are not GitHub or remote-CI evidence. Skip fixtures cover both the documented CLI plan/aggregate exception and fail-closed cases.
