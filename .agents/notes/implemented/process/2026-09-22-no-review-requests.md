# Agent Note: No automatic review requests

Status: implemented
Owner: repository owner (@HeadmasterEggy)

## Problem

A `.github/CODEOWNERS` file mapped each module to an owner so GitHub requested that person's review on
every pull request touching it. Approval was never required, so the requests only added notifications,
and the module-to-account mapping was inferred rather than agreed by the team.

## Decision

The repository has no `CODEOWNERS` file and GitHub requests no reviews automatically. Authors merge
their own pull requests once CI passes and ask a teammate themselves when a change crosses modules, as
[team-workflow.md](../../../../docs/team-workflow.md) states. The ownership table there stays as a
guide to who knows each area. The mechanical guards are unchanged: the `protected-files` and
`verify-docs` CI checks. This partly supersedes the
[collaboration guardrails note](2026-09-22-agent-collaboration-guardrails.md), which remains in force
otherwise.

## Alternatives considered

**Keep CODEOWNERS for review requests only.** Rejected by the repository owner: nobody is expected to
review, so automatic requests are noise.

**Require code-owner approval.** Already rejected in the guardrails note: authors must be able to merge
their own pull requests.

## Consequences

- Nothing prompts a second look at a pull request; review happens only when someone asks for it.
- Module owners in `team-workflow.md` and package READMEs are informational and need no GitHub access.

## Sources

The repository owner's instruction on 2026-09-22.
