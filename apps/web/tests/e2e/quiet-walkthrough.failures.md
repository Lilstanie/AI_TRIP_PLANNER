# Quiet panel walkthrough: failure inventory

Written before the script (#764, spec #755). Each line is a way the whole quiet panel could fail when its parts meet. The agreed seam is the real Trip workspace in a browser at 1440x1500 with a mouse, at 390x844 with touch and at 1440x1500 in Chinese, one saved fixture Trip (priced and unpriced stops, a flight, a stay, parked places, seven saved tips) and the mock edit route. It covers what the traveller sees and the saved plan.

## Order and weight

- The panel does not read budget line, ideas chip, days, Add button, Travel tips from top to bottom, or an old section (Ideas, tips, a second budget block) comes back between them.
- The budget is not collapsed to one line, repeats the estimated total, shows a provider description, or does not list one row per category when tapped and one line again when tapped twice.
- The unpriced count is missing beside the budget line when stops have no price.
- Travel tips start unfolded, show more than five items, or show a second sentence of an old tip.
- A stop still carries a Place confirmed, Planned or Price needs checking tag; the day still ends on a drag helper sentence; Show distances still renders; legs lose Directions.
- The time cell or the flight icon has a fill, at rest, on hover or with its popover open, or the time no longer changes colour.

## Ask AI

- A full-width Ask AI bar renders on a day or a stop, or the Ask AI item is missing from the stop menu or the day menu, or is untranslated in Chinese.
- Choosing it sends a different message than the earlier bars sent, or does not show the chat (on a phone the Trip view stays up after the request is sent).

## Ideas chip

- The chip count is wrong, has no accessible name, is under 44 px on a phone, or opens the Add to trip panel on another tab.
- Dragging a stop does not mark the chip as a drop target, the drop does not park the stop with one edit, or Undo does not restore it.

## Sidebar and Trajectory

- The sidebar shows a plus button beside Chats, or a New chat row next to New trip.
- With the Trip panel open, pressing Trajectory or Conversation leaves the Trip panel showing, selects the wrong view, or the Trip button no longer reopens the panel.
- The Trajectory toolbar lost its glass restyle (no blur, no fill) or a phone shows a Trajectory tab inside the Trip view.

## Whole run

- Any page error, sideways page scroll, or an English string left in the Chinese run.
- The run writes no result.json or no screenshots, so it cannot be repeated or reviewed.
