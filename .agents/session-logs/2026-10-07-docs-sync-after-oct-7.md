---
date: 2026-10-07
author: Claude (with Joey / @HeadmasterEggy)
branch: docs/sync-after-oct-7
pr: none
area: docs, README, GLOSSARY.md
contract-impact: none
---

# Docs catch up with the flight card, alternatives and intra-city legs

## What changed

- `docs/workspace-ui.md` and its Chinese pair: new "Trip sections" covering Getting around with
  intra-city legs, the flight and stay cards, Also found and choosing an alternative; "Reviewing a
  plan" no longer says a different stay has to be asked for in chat.
- `docs/roadmap.md` and its Chinese pair: status dated 2026-10-07, Done adds the phone layout,
  language and display currency, and flights and stays.
- `README.md`, `README.zh.md`: layout tree matches `apps/web`, the API row no longer says six routes,
  the DSH thinking UI row is gone (it stays in the docs index), and the glossary is linked.
- `GLOSSARY.md`: **Alternative**.

## Why

#211 and #214 changed no docs and #212 changed only `docs/api.md`. Joey reviewed the gaps through
/grill-with-docs and took every recommendation.

## Validation

`pnpm verify:docs`, `pnpm verify:pairs` (24 pairs) and `pnpm verify:protected` pass. Prettier is
clean on both READMEs; `docs/workspace-ui*.md` already failed `prettier --check` on main and still do.

## Notes for the next person

The glossary's **Fare** means a provider price in its own currency, while code and branch names use
"fare" for a flight option (`choose-fare-and-stay`). These docs say "flight" for the option.
