---
date: 2026-09-24
author: Claude Code (Opus 5.5)
branch: docs/interface-skills
pr: none
area: .agents/skills, docs/design
contract-impact: none
---

# Adapt five interface skills from jakubkrehel/skills and allow glass on the control layer

## What changed

- New skills in `.agents/skills/`: `better-accessibility`, `better-layout`, `better-ui` (with a new
  `glass.md`), `better-writing` and the manual `break`. Each `SKILL.md` is rewritten around this
  project's tokens, components and docs, and the generic references are copied. Provenance and the
  MIT licence are in `THIRD_PARTY_NOTICES.md`.
- `docs/design/ui-guidelines.md`: glass is allowed on the control layer, with token, contrast and
  fallback rules. Neon, noise, texture images and illustrations stay banned. Adds two
  references: Aceternity UI, for restrained micro-interactions only, and Mindtrip, whose
  interactions were observed in a logged-in chat. Provider place photos are allowed; decorative
  photography stays banned.
- New Agent Notes: `process/2026-09-24-interface-skills.md`,
  `feature/2026-09-24-glass-control-layer.md` and `feature/2026-09-24-place-photos.md`.
- `ui-verification` now links to the new skills.

## Why

The upstream skills prescribe exact values that clash with the design contract, so they are adapted
rather than installed. The repository owner asked for iOS-style glass. It is limited to the control
layer so that dense reading surfaces keep their contrast. The notes record the rationale.

## Validation

- `npx prettier --write` on the changed Markdown.
- `pnpm verify:docs`: "Agent Notes, skills and Markdown links are valid."
- `pnpm verify:protected`: "Protected-file rules hold relative to origin/main."
- No code changed, so no UI or browser check applies.

## Notes for the next person

- No provider fetches place photos yet. Showing them needs fresh Places photo names (never cached), quota
  limits and a mock fallback (add-provider skill).
- No surface uses glass yet. The first change that does adds `--glass-*` tokens to `tokens.css` and
  checks contrast over real map tiles in both themes.
- The global focus ring in `base.css` is a `box-shadow` with `outline: none`, so it disappears in
  forced-colors mode. This is not fixed here.
