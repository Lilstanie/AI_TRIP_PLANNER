# Team panel on the phone failure inventory

Before changing production code, the retained browser journey must distinguish these failures:

- The phone top bar has no Specialist team button right of the trip title, or the button has no accessible name.
- The button is smaller than 44px in either direction, or sits outside the top bar.
- The top bar wraps to a second row at 390x844 or 360x800, or a long trip title wraps instead of truncating.
- Tapping the button opens nothing, or opens something other than a modal dialog named "Specialist team".
- The sheet lists fewer or more than six assistants, omits a status, or lacks the round's assignments after a plan.
- Focus does not move into the sheet or Tab escapes the sheet.
- Esc, the close button or a tap outside leaves the sheet open, or focus does not return to the button.
- Long content does not scroll inside the sheet, or after closing the tab bar is covered or not tappable.
- The trip-facts sheet and the team sheet are open at once.
- The sheet stays open after resizing to desktop width, or the desktop hover control appears on the phone.
- The button shows no working state while a specialist works.
- Chinese labels appear in English.
- The page overflows horizontally.

The E2E runs in mock data mode with no keys against a production build. The first run is expected to fail before implementation.

TP-110 capsule scenarios, written before the change:

- The idle phone capsule shows one avatar instead of three stacked avatars.
- A working phone capsule shows more than three avatars, lists a working specialist after an idle one, or grows past 96px.
- `trajectory-demo` taps the phone team button and waits for `.team-panel` while the roster `<details>` in the sheet is still closed.
