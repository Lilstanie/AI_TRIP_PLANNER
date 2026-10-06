---
date: 2026-10-06
author: Claude Code
branch: docs/glossary-rename
pr: none
area: docs
contract-impact: none
---

# Rename the root CONTEXT.md glossary to GLOSSARY.md

## What changed

- `git mv CONTEXT.md GLOSSARY.md`; content unchanged.
- `docs/agents/domain.md`, `docs/i18n.md` and their `.zh.md` pairs, plus the translate-docs skill,
  now name `GLOSSARY.md`.
- The engineering-skills Agent Note keeps its decision; only the file name fact is updated.

## Why

mattpocock/skills v1.3.0 renamed the domain-doc convention from `CONTEXT.md` to `GLOSSARY.md`.
The upstream skills (grill-with-docs, domain-modeling, tdd, triage and others) now look only for
`GLOSSARY.md`, so keeping the old name would leave them blind to it or create a second glossary.

## Validation

See the pull request description for the commands run and their results.

## Notes for the next person

Frozen session logs and archived notes still say `CONTEXT.md`; that is history and stays as is.
