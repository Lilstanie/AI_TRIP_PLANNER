# PR delivery status failure inventory

Before the checker can report a pull request ready, these failures must be observable:

- `gh` is missing, fails, returns invalid JSON, or cannot find the requested pull request.
- The local checkout is detached, dirty, on another branch, or its commit differs from the PR's exact head SHA.
- The pull request is closed, merged, or targets a base other than `main`.
- GitHub reports no checks, a pending/queued/running/skipped check, a failed check, or an unreadable check result.
- The PR body omits, empties, or leaves placeholder text in Summary, Evidence, or Merge Danger.
- Evidence has no concrete test/check command or result, or gives no explicit limits for fixture/mock and unverified behavior.
- A fixture-based self-check is mistaken for evidence about GitHub, remote CI, or a real provider.
- A checker path invokes a mutating GitHub or Git operation such as push, merge, close, or branch deletion.

The self-check will drive the actual CLI against temporary Git repositories and a fake `gh` executable. Those fixtures verify checker behavior only; they are not GitHub or remote-CI evidence.
