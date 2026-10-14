---
date: 2026-10-14
author: Claude
branch: feature/issue-templates
pr: none
area: .github, docs
contract-impact: none
---

# Add GitHub issue forms for bugs, UI improvements and ideas

## What changed

- `.github/ISSUE_TEMPLATE/bug.yml`, `ui-improvement.yml` and `idea.yml`: issue forms with required fields and
  automatic labels (`bug` or `enhancement`, plus `needs-triage`).
- `docs/agents/issue-tracker.md` and its Chinese pair: new "Issue templates" section.

## Why

Contributors without triage permission cannot add labels, and a free-form issue gives no reproduction
steps. A form applies its labels whatever the reporter's permission and makes the fields required.
`.github/**` is protected; the user explicitly approved this change in chat.

## Validation

See the pull request description for the commands that were run.

## Notes for the next person

`blank_issues_enabled` is left at its default, so a blank issue is still possible. The forms only take
effect once merged to the default branch.
