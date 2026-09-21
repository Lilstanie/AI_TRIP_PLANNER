# Agent Notes

An Agent Note records a decision that affects this codebase: the problem, what was chosen, what it
beat and what it costs. Code shows _what_; a note keeps the _why_ so a later person or AI session does
not re-argue it. Session logs record what one session did; they are not decisions. The layout follows
DeepSeek Harness's `.agents/notes`; `pnpm verify:docs` checks it.

## Layout and naming

Every note lives at `{lifecycle}/{class}/yyyy-mm-dd-topic.md`. The date is when the topic was first
proposed. Link between notes with relative Markdown links so the check can resolve them.

| Lifecycle      | Meaning                                                   | Editing rule                                                                                                      |
| -------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `proposed/`    | Under discussion; not built, or only partly               | Edit freely during review                                                                                         |
| `implemented/` | Shipped and in effect                                     | Keep facts (paths, names, defaults) current in the same change that alters them; never change the decision itself |
| `rejected/`    | Considered and declined                                   | Frozen. Delete it once its rationale no longer prevents a tempting mistake                                        |
| `archived/`    | Shipped, but unlikely to guide future work, or superseded | Frozen. Only an `implemented/` note can be archived                                                               |

| Class            | Covers                                                                             |
| ---------------- | ---------------------------------------------------------------------------------- |
| `feature`        | A new user- or model-facing capability                                             |
| `bug-fix`        | Corrects a defect or closes a gap an incident exposed                              |
| `simplification` | Removes code, behaviour or surface area without adding a capability                |
| `architecture`   | A structural decision about shipped source: package boundaries, contracts, storage |
| `process`        | Tooling, policy or workflow around the code: CI, scripts, team rules, skills       |
| `testing`        | Test infrastructure and strategy                                                   |

`architecture` is about the code we ship; `process` is about how we build it. Adding a class means
updating this table and `scripts/verify-docs.mjs` together.

## When to write one

Write or update a note in the same pull request as:

- a change to `packages/shared` or an API route contract (CI requires it for `packages/shared/src`);
- a choice between real alternatives that someone could reasonably revisit;
- a team rule, tool or workflow change, including a new skill.

Local refactors, UI tweaks and bug fixes with an obvious cause do not need one. Update the note that
already owns a decision instead of writing a duplicate. Every new note starts with a supersession
check; see the [agent-notes skill](../skills/agent-notes/SKILL.md).

## Changing lifecycle

- `proposed/` → `implemented/`: rewrite `## Proposal` as a present-tense `## Decision`, fold
  `## Acceptance criteria` and `## Risks` into `## Consequences`, and set `Status: implemented`.
- `proposed/` → `rejected/`: set `Status: rejected — <why>`; the file is then frozen.
- `implemented/` → `archived/`: move the file unchanged except for one `Archived: YYYY-MM-DD` line
  directly below `Status: implemented`, then repair inbound links. It is then frozen.
- A reversed decision gets a new note that links to the old one; the old note is archived in the same
  pull request.

## Format

The first lines are fixed; `Archived:` appears only in `archived/`, and `Owner:` is optional.

```markdown
# Agent Note: <title>

Status: proposed | implemented | rejected — <one-line reason>
Archived: YYYY-MM-DD
Owner: <module letter and GitHub handle>
```

Required sections, in this order:

| Lifecycle                | Sections                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| `proposed/`              | `## Problem`, `## Proposal`, `## Alternatives considered`, `## Acceptance criteria`, `## Risks` |
| `implemented/`           | `## Problem`, `## Decision`, `## Alternatives considered`, `## Consequences`                    |
| `rejected/`, `archived/` | Whatever they had when frozen                                                                   |

Other sections, such as `## Sources` or a schema, may appear between them. An implemented note may not
contain `## Proposal`, `## Plan` or `## Acceptance criteria`. `## Alternatives considered` lists each
real alternative and why it lost; record alternatives, never invent them.
