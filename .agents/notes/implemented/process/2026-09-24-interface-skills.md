# Agent Note: Interface skills adapted from jakubkrehel/skills

Status: implemented
Owner: repository owner (@HeadmasterEggy)

## Problem

The repository's UI skill, [ui-verification](../../../skills/ui-verification/SKILL.md), checks that a
visible change works in a browser. No skill says what good accessibility, layout, polish or copy look
like in this workspace, so each session re-derives them or falls back on generic habits. The
community collection [jakubkrehel/skills](https://github.com/jakubkrehel/skills) covers these areas
well, but it is written for any project. It prescribes exact spacing, shadow, colour and motion
values that conflict with this project's
[design contract](../../../../docs/design/ui-guidelines.md) and tokens.

## Decision

Five of its eleven skills are adapted into `.agents/skills/`: `better-accessibility`,
`better-layout`, `better-ui`, `better-writing` and `break`. Each `SKILL.md` is rewritten so that the
project's facts win:

- the tokens and the fixed workspace layout;
- the existing Drawer, Dialog, focus-ring and reduced-motion patterns;
- AUD amounts and honest source provenance;
- the `ui-verification` widths.

Each skill links to the document that owns a fact instead of restating it. The generic reference
files are kept where they do not conflict. `break` is manual-only (`disable-model-invocation`), and
its harness is a dev-only `apps/web/app/debug/break-*` page that is never committed. Provenance and
the MIT licence are in [THIRD_PARTY_NOTICES.md](../../../skills/THIRD_PARTY_NOTICES.md).

## Alternatives considered

**Install the whole collection with `npx skills add`.** Rejected for several reasons:

- It pulls unpinned third-party instructions into every session.
- It adds six more automatically triggered skills.
- `better-colors`, `better-typography` and `better-ui` would prescribe values that contradict the
  contract.

**Skip `better-colors`, `better-typography`, `better-interface`, `interface-review`,
`explain-interface` and `variant`.** Adopted.

- Colour and type are already fixed by the design contract and `tokens.css`.
- The two combined review skills would reintroduce those conflicting rules.
- Explaining third-party interfaces and generating design variants are not recurring work here.

**Write the skills from scratch.** Not adopted. The upstream accessibility and layout references are
accurate, generic web guidance, and rewriting them would add nothing specific to this project.

## Consequences

- Updates from upstream are not automatic. Pulling one means diffing against the recorded commit and
  keeping the project overrides.
- These skills cite files, tokens and components such as `Drawer.tsx`, `--drawer-duration` and
  `.trip-map-*`. Renaming one of those means updating the skill in the same pull request.
- The accessibility skill documents a known gap: the global focus ring is a `box-shadow`, which
  forced-colors mode removes.
