---
date: 2026-10-30
author: Codex
branch: feature/TP-144-trip-home-workspace
pr: 782
area: apps/web, docs
contract-impact: none
---

# Trip chats open the normal workspace; home columns move inward

## What changed

- `WorkspaceView` removes embedded Chat state, effects and duplicated error UI. Linked Chat
  selection and first send use the existing normal conversation navigation.
- Trip action cards use the existing route, pin, suitcase, sliders and calendar icons in two
  desktop columns. Numeric counts remain on the right.
- Trip home keeps spacious columns with 24px desktop outer insets and a 1440px maximum width.
  Tablet and phone retain full width. Action drawers follow the centered map.
- Updated paired UI/design docs and added the partially superseding
  [navigation decision](../notes/implemented/feature/2026-10-30-trip-home-chat-navigation.md).

## Validation

- `pnpm --filter @trip/web e2e run trip-home-send`: 182/182 assertions passed with local fixtures;
  no browser errors or external requests. Covers 1920px desktop, responsive boundaries, EN/ZH,
  linked Chat navigation, first-send focus, background generation and drawer/map placement.
- Evidence: `output/e2e/local-test-cli/2026-10-30T03-02-11-761Z-16820-gg3oae/`.
  Desktop and phone Chinese screenshots inspected visually.
- Earlier run `2026-10-30T02-55-59-403Z-11801-mg4imb` failed on an obsolete `.trip` test locator;
  corrected to the normal Trip workspace locator. Intermediate run passed.
- Web typecheck and scoped Next lint passed. Docs, pairs, protected-file, E2E-selector,
  UI-copy, Prettier and diff checks passed.

## Notes for the next person

The owner rejected the initial 1080px width cap as too narrow; preserve the final modest inset.
Local preview responds on port 3000. No remote write or merge. Existing unrelated WIP is preserved.
The older Google-renderer action-panel journey was adapted to normal Chat navigation but was not
rerun; centered drawer placement is covered in the passing first-send journey.
Live providers, real phone keyboards and the separate Calendar spec blocker remain unverified here.
