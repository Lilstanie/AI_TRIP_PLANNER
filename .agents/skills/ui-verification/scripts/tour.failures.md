# Screen tour failure inventory

`node .agents/skills/ui-verification/scripts/tour.mjs [--base <url>] [--name <label>] [--views desktop,phone] [--langs zh,en] [--dark]`
plans the first example trip on mock data in a fresh browser per view, language and theme, then saves
one screenshot per screen in `apps/web/tests/e2e/support/ui-tour.mjs` under
`output/playwright/tour/<label>/<view>-<lang>-<theme>/`. Written before the script, from the
2026-11-02 UI loop, where every round rebuilt this setup by hand. These failures must be observable:

- The dev server is not running: say so with the start command instead of timing out per screen.
- Settings are only partly seeded, so the app falls back to live data and the plan fails locally.
- The mock plan never finishes, so every trip screen is a screenshot of the empty chat.
- A screen cannot be opened and the run still exits 0, so a missing screen looks covered.
- Files from an earlier run with the same label are mixed into this run's evidence.
- An unknown view, language or argument is ignored instead of failing with usage.
- The Next dev-tools badge covers the bottom-left corner of phone screenshots.
