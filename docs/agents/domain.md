# Domain Docs

This repository uses a single-context domain-document layout. The engineering skills should consume the shared domain documentation before exploring the codebase.

## Before exploring, read these

- **`GLOSSARY.md`** at the repository root.
- **`docs/adr/`**: read ADRs that touch the area you are about to work in.

If these files do not exist, **proceed silently**. Do not flag their absence or suggest creating them upfront. The `/domain-modeling` skill—reached through `/grill-with-docs` and `/improve-codebase-architecture`—creates them lazily when terms or decisions are actually resolved.

## File structure

```text
/
├── GLOSSARY.md
├── docs/
│   └── adr/
├── apps/
└── packages/
```

## Use the glossary's vocabulary

When your output names a domain concept—in an issue title, refactor proposal, hypothesis, or test name—use the term as defined in `GLOSSARY.md`. Do not drift to synonyms the glossary explicitly avoids.

If the concept you need is not in the glossary yet, that is a signal: either you are inventing language the project does not use, or there is a real gap to note for `/domain-modeling`.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding it:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because…_
