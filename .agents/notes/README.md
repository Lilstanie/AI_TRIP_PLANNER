# Agent Notes

An Agent Note records a decision that affects this codebase: the problem, what was chosen, what it
beat and what it costs. Code shows _what_; a note keeps the _why_ so a later person or AI session does
not re-argue it. Session logs record what one session did; they are not decisions.

## Layout

`{status}/yyyy-mm-dd-topic.md`, where the date is when the topic was first proposed.

| Folder      | Meaning                         | Editing rule                                                                                                      |
| ----------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `proposed/` | Under discussion, not yet built | Edit freely during review                                                                                         |
| `accepted/` | Agreed and in effect            | Keep facts (paths, names, defaults) current in the same change that alters them; never change the decision itself |
| `rejected/` | Considered and declined         | Frozen; `pnpm verify:protected` rejects any edit                                                                  |

To reverse or replace an accepted decision, write a new note that links to the old one, then move the
old note to `rejected/` in the same pull request with a `Status: rejected — superseded by …` line.

## When to write one

- A change to `packages/shared` or an API route contract.
- A choice between real alternatives that someone could reasonably revisit.
- A team rule or process change.

Local refactors, UI tweaks and bug fixes with an obvious cause do not need one.

## Format

```markdown
# Agent Note: <title>

Status: proposed | accepted | rejected — <one-line reason>
Owner: <module letter and GitHub handle>

## Problem

## Decision (proposed notes use "## Proposal")

## Alternatives considered

## Consequences
```

`Alternatives considered` is required: each real alternative and why it lost.
