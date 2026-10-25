# Team panel on desktop failure inventory

Before changing production code, the retained browser journey must distinguish these failures:

- The top bar has no Specialist team button left of Trip, or the button has no accessible name.
- Hovering the button does not open the panel, clicking does not pin it, or the panel opens on its own after a turn.
- Esc or a click outside leaves a pinned panel open, or Esc moves focus to the button when focus was outside the panel.
- A click on the button leaves a hover-opened or pinned panel open.
- The popover is not a dialog named like the button, the button lacks `aria-controls` for it, opening by keyboard leaves focus outside it, or hovering takes focus.
- Two identical hand-off events log a duplicate-key error or collapse into one assignment.
- The panel lists fewer or more than six assistants, in an order other than `ASSISTANT_ORDER`, or omits an icon, current name or status.
- A row jumps between idle, working, done, needs change and not involved states, or a single mention leaves the other specialists "done".
- The button shows no "N working" while planning, or its avatars do not animate while a specialist works.
- At 521-1000px the button still shows its text and overflows the top bar.
- A budget conflict turn omits the dispatch assignments, the conflict naming the specialist with "needs change", the revision assignment, the kept or discarded result or the stop reason.
- A misdirected mention shows no hand-off, or shows it as more than one assignment row.
- An assignment carries no "Decided by AI" or "Decided by code" marker, or no data source.
- Chinese or custom assistant names appear in English.
- The panel body is not DSH's layout: no Members heading with a count of six, no roster of cards (icon, name, status dot, current assignment tag), or no Assignments board with one card per assignment (owner, status dot, two-line clamp with a Show more toggle).
- A greyed non-participant card is pressable, or a participant's card is not a named button.
- A conflict card is missing, shows no icon-free rule text, or omits the specialist it names.
- A revision card hides whether the revision was kept or discarded.
- Pressing a specialist's card expands thinking rows instead of opening the Trajectory tab, or leaves the Conversation tab selected.
- `TeamConversation` still renders above the composer, or the thinking process disappears.
- The page overflows horizontally or the panel leaves the viewport.

The E2E runs in mock data mode with no keys. The first run is expected to fail before implementation.
