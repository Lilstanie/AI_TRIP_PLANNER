# Agent Note: Require a code-owner review before merging to main

Status: implemented
Owner: A (@Lilstanie)

## Problem

`main` had no protection at all. The "preview before merge main" ruleset existed and was marked
active, but its branch condition was empty, so it matched no refs and enforced nothing from the day
it was created. Every collaborator could push straight to `main`, force-push it or delete it, and a
pull request could merge with failing CI.

[No automatic review requests](../../archived/process/2026-09-22-no-review-requests.md) had decided
that authors merge their own pull requests and that no approval is required. That decision assumed
the mechanical CI guards were the thing holding the line, but those guards were not required to pass
before a merge either.

## Decision

The ruleset targets the default branch and enforces a pull request with one approving review, an
approval from a code owner, four required status checks (`check`, `added-comments`,
`protected-files`, `cli-acceptance`), no force pushes and no deletion. `.github/CODEOWNERS` names
`@Lilstanie` and `@HeadmasterEggy` for every path, so one of them approves every change and neither
can approve their own pull request.

Both accounts are bypass actors, so either can merge without an approval when a release needs it.
The other three members cannot: their pull requests need an approval from one of the two owners and
green CI.

This reverses the archived decision above on the point of approval. The rest of that note still
describes why module-to-account ownership was dropped, and this note does not bring it back: the
`CODEOWNERS` entry is a single rule for every path, not a module map.

## Alternatives considered

**Keep authors merging their own pull requests, and only fix the branch condition.** Rejected by the
repository owner: it leaves `main` able to take an unreviewed change from any of the five accounts,
which is the risk that prompted the change.

**Per-module `CODEOWNERS`, as the repository had before 2026-09-22.** Rejected: each member would own
the modules they work in, so their own changes would need no second person, which is the outcome the
owner asked to prevent.

**Give `@HeadmasterEggy` the `maintain` role and bypass by role.** Not available: the repository
belongs to a personal account, where collaborators can only hold read, write or admin, and `maintain`
is refused. Individual accounts can be bypass actors directly, so the role change was unnecessary.

## Consequences

- A pull request from member B, D or E cannot merge until `@Lilstanie` or `@HeadmasterEggy` approves
  it and the four checks pass. Plan for that in a deadline week.
- The two owners can still merge their own work unreviewed through the bypass list. The guarantee is
  about the other three accounts, not about them.
- `AGENTS.md` and [team-workflow.md](../../../../docs/team-workflow.md) no longer tell authors to
  merge their own pull requests.
- An AI session acting under an author's account still cannot be the second reviewer, the reason
  [the collaboration guardrails](2026-09-22-agent-collaboration-guardrails.md) first rejected
  code-owner approval. That still holds, and it is why the approval has to come from one of two
  named people rather than from any account with write access.
