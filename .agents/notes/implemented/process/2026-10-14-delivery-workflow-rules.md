# Agent Note: Delivery workflow rules live in AGENTS.md and the PR template

Status: implemented
Owner: repository owner (@HeadmasterEggy)

## Problem

The owner's delivery workflow (triage, implement, pre-push checks, a structured PR body, CI, then stop
before merging) existed only as personal skills such as `/pr` and `/retro`. A fresh AI session, or a
teammate's tool, never read it: a pull request was opened with a hand-written body, and the owner had to
run `/pr` afterwards. `.github/workflows` cannot fix this because it runs on GitHub, not in an AI session.

## Decision

- [`AGENTS.md`](../../../../AGENTS.md) has a `## Delivery workflow` section with five rules: triage before
  implementing, run the checks `pre-push-checks` selects, write every pull request body with the
  template's three sections, and stop once CI passes on the current head until the user says to merge, then run `pnpm clean:output` once the evidence is quoted in the pull request. The command deletes only the four ignored scratch directories and refuses if a tracked file is under any of them.
- [`.github/pull_request_template.md`](../../../../.github/pull_request_template.md) carries the Summary,
  Evidence and Merge Danger sections, so a pull request opened in the browser starts from them. A
  change with no runnable before and after says so and lists the commands it ran; Merge Danger is
  always filled in.
- The full personal workflow stays in the owner's own tool configuration, outside the repository,
  because its skills (`/pr`, `/retro`, `/grill-with-docs`) are not part of this repository.

## Alternatives considered

**A GitHub Actions workflow.** Rejected: it runs on GitHub's servers and cannot instruct an AI session.
It could only check a pull request body after the fact.

**A hook that blocks `gh pr create` without the template.** Not adopted yet: hooks are brittle and can
block legitimate commands. The
[collaboration guardrails note](2026-09-22-agent-collaboration-guardrails.md) found prose rules
followed unreliably, so this is revisited if pull requests keep arriving without the three sections.

**Copy the owner's skills into `.agents/skills`.** Rejected for now: most of them are personal and a
teammate's AI would take them as required.

## Consequences

- `gh pr create --body` bypasses the template, so rule 3 in `AGENTS.md` is what covers an AI opening a
  pull request from the command line.
- Authors still merge their own pull requests; rule 4 only stops an AI before it merges.
- The rules depend on an AI reading `AGENTS.md`; nothing fails CI when they are skipped.
