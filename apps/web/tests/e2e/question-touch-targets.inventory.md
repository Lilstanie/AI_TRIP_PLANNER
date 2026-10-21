# Question card touch targets: failure inventory

Written before the production patch for #466. The public seam is the question card in the workspace
and the next chat request it sends.

- Collapse, Dismiss all, Previous or Next has a hit area smaller than 44 × 44 px at phone widths.
- Skip or Next/Submit stays shorter than 44 px on phones.
- Enlarging targets also enlarges the existing 14/16 px SVGs.
- Collapse and destructive Dismiss all remain only 4 px apart.
- Enlarged controls overlap each other, the question heading or phone navigation, or overflow at 320 px.
- The phone rules leak above the 520 px boundary or change desktop controls.
- Pager navigation or collapse/expand loses the selected answer.
- Disabled navigation becomes active, Skip retains discarded text, or Submit changes answer formatting.
- Skipping the last question stops submitting; Dismiss all sends a request or fails to restore the composer.
- English or Chinese layout fails, or the browser reports an error.

Run `CHANNEL=chrome USE_MOCK_TOOLS=1 pnpm --filter @trip/web e2e question-touch-targets` without
model, Maps or Clerk credentials. `EVIDENCE_LABEL=before` selects the baseline directory; the default
is `after`. `BASE_URL`, `CHANNEL` and `PLAYWRIGHT` are optional runner overrides.

The script starts with blank browser storage, dismisses the location prompt and hides the development
badge. It injects deterministic three-question `ask_user` frames at `/api/chat`, then checks both
locales at 320 × 568, 390 × 844, 520 × 844, 521 × 844 and 1440 × 1000. Screenshots and measured
geometry are written under `output/playwright/question-touch-targets/<label>/`. Chrome shutdown
has a five-second bound after contexts close. This is fixture browser evidence, not live-model,
authentication, physical-device or on-screen-keyboard evidence.
