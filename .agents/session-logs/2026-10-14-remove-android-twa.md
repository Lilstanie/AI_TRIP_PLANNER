---
date: 2026-10-14
author: Claude
branch: chore/remove-android-twa
pr: none
area: apps/android-twa, apps/web, docs, .agents
contract-impact: none
---

# Remove the Android TWA project and its build guide

## What changed

- Deleted `apps/android-twa/` (38 files) and `apps/web/public/.well-known/assetlinks.json`.
- `installable-app.e2e.mjs`: dropped the two `assetlinks.json` checks.
- `docs/development.md`, `.zh.md`: removed the Android APK guide; Android installs from Chrome's menu.
- `docs/roadmap.md`, `.zh.md`: dropped the pointer to #182. `docs/e2e-known-failures*`: 24 checks became 22.
- `pre-push-checks`: manifest and service worker row no longer names `assetlinks` or the TWA project.
- New note `2026-10-14-drop-android-wrapper.md`; the installable-app and phone-shell notes link to it.

## Why

The owner does not want a phone app now. The PWA and the phone layout stay, so phones still work.
Historic session logs, archived notes and the rendered diagrams still mention the TWA and are left as written.

## Validation

See the pull request description.

## Notes for the next person

`feature/ios-app` (`c01ecbf5`, `72c8e94e`) was deleted locally; recover it from the reflog if needed.
