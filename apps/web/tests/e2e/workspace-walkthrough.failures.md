# Workspace walkthrough: failure inventory

Written before the E2E (#739, TP-113). Public seam: the production build in fixture mode (mock tools, no
keys), driven in a real browser at desktop 1440x1000, phone 390x844 and phone 360x800, each in light and
dark appearance. Each line is a way the redesigned workspace could fail as a whole even though each
ticket's own E2E passes.

- A floating surface (top bar, sidebar, open-items popover, team panel, phone tab bar, phone map hint) has
  no backdrop blur in one theme or at one size, or a content card (trip panel, chat bubble) has one.
- Dark appearance leaves a glass surface with a light tint, or light appearance a dark one, so text on it
  fails 4.5:1 against its own backdrop.
- Any size has horizontal page scroll, or a top bar that wraps to a second row with the trip title,
  open-items badge and team capsule together.
- The empty Map (desktop and phone) shows a grey void, a placeholder card, a location prompt, a browser
  geolocation request before Locate me is tapped, or a Day stops sheet.
- The phone empty Chat, Trips and Mine screens say one thing twice or offer more than one action.
- New trip, Calendar or the Chats plus button in the sidebar opens the wrong place, or is missing when the
  sidebar is collapsed.
- The planned trip's Trip panel still shows a Trip issues block, or opens on the budget breakdown instead
  of the day plan.
- The open-items badge count differs from the popover rows, shows at zero, or a row does not open its stop.
- The team capsule shows more or fewer than three avatars, or the six-row panel no longer opens from it.
- The Trajectory tab opens on the full ledger rather than the simple list, the switch to Full view fails,
  or the two views disagree on the number of turns.
- The Agent Team or Trajectory takes more than two taps or clicks to reach from the planned workspace at
  any size.
- Any step logs a page error.
- The run leaves no ordered screenshot set or JSON summary, so the walkthrough cannot be repeated or
  verified.
- The phone empty Trajectory sheet stretches its Plan in Chat button to fill the sheet height instead of keeping a 44 px target (found by this walkthrough: 344 px tall at 390x844).
