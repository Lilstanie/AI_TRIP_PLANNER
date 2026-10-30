# Final screenshot failure inventory

`node .agents/skills/ui-verification/scripts/snap.mjs <url> [--selector <css>] [--name <label>] [--dark]`
opens `<url>` at desktop 1440 × 1000 and phone 390 × 844 (and the same two in dark mode with `--dark`)
and saves one screenshot per view under `output/playwright/snap/<label>/`. These failures must be
observable:

- No URL, an unknown argument or a flag without a value: usage error, exit 2, no browser started.
- The page does not load (server down, HTTP 4xx/5xx): report the status and exit 1, instead of saving
  a screenshot of an error page as evidence.
- `--selector` matches nothing in a view: name the view and exit 1, instead of falling back to a
  full-page shot that does not show the change.
- The phone view scrolls horizontally (`scrollWidth` larger than the viewport): report the widths and
  exit 1.
- A page error or console error during load passes silently; it must be printed with its view.
- An old screenshot from a previous run is reported as this run's evidence; the run must overwrite
  every file it lists.
- Playwright cannot be resolved: say which module path was tried (`PLAYWRIGHT` or `playwright`).
