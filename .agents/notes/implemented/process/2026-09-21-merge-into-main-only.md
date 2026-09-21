# Agent Note: Pull requests merge into main only

Status: implemented
Owner: A (@Lilstanie)

## Problem

PRs #32–#36 were stacked, each based on the previous feature branch, and each was merged into its
base branch. GitHub showed every one as merged, but none of the work was on `main`; integration PR
#37 had to carry the accumulated result into `main` afterwards.

## Decision

Every pull request merges into `main`, as stated in [team-workflow.md](../../../../docs/team-workflow.md).
A dependent change may be based on an open branch, but the lower pull request merges first and the
next one is retargeted to `main` before it merges.

## Alternatives considered

**Keep merging into feature bases and finish with an integration PR.** Rejected: "merged" stops
meaning "on `main`", and the integration PR carries changes nobody reviewed together.

**GitHub's native stacked pull requests, as DeepSeek Harness requires.** Not adopted yet: the team
has stacked once, and retargeting by hand is enough at this size.

## Consequences

- A stack lands one layer at a time, with a retarget between layers.
- A merged pull request is always on `main`.

## Sources

The archived [product closure TODO](../../../archive/todo-product-closure.md), section on the merge
record of #31–#37.
