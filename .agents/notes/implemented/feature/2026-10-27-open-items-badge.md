# Agent Note: An open-items badge replaces the Trip issues block

Status: implemented
Owner: spec #730, ticket #732

## Problem

The [Trip redesign](2026-10-26-trip-redesign.md) (#721, #724) decided on a compact issue summary in
the trip panel. It shipped as a collapsible "Trip issues" block under the budget. It takes a section
of the panel even when collapsed, counts unpriced stops as issues although a free activity is normal,
and repeats what the budget's "Not included" note already says.

## Decision

- The Trip issues block is removed from the trip panel on desktop, tablet and phone.
- `OpenItemsBadge` (`apps/web/components/trip/OpenItemsBadge.tsx`) shows a count next to the trip
  title: in the desktop top bar after the title, and in the phone top bar after the phone trip title.
  No badge is rendered when the count is zero.
- The count is time conflicts plus unlocated places plus failed place lookups, derived by
  `deriveOpenItems` in `apps/web/lib/trip/open-items.ts` from the plan and the place lookup state.
  Unpriced items are not counted; they stay only as the budget breakdown's "Not included" note.
  Free-text edit notices of the old block are dropped; conflicts stay marked on the stop itself.
- Tapping the badge opens a popover with `glass-float glass-float--raised` and opaque rows grouped by
  kind. A row selects its day and its stop and closes the popover; Esc and an outside click also close it.
- The glossary term **Open item** names these entries (avoid: issue, problem).

This supersedes the compact issue summary bullet of the Trip redesign note, in part: the rest of that
note stands.

## Alternatives considered

- Keep the block but collapse it by default: it still takes a row of the panel and keeps unpriced
  items in the count.
- Show the count inside the trip panel header only: the top bar title is visible on every view, the
  panel is not.

## Consequences

- The trip panel opens on the budget summary and the day plan, with no extra section.
- A traveller sees the count while another view is open; selecting a row from a view that does not
  show the timeline selects the stop but does not switch view.
- Unpriced stops no longer appear as open items, so only the budget note reports them.

## Sources

- Spec #730, ticket #732 (TP-115); the [Trip redesign note](2026-10-26-trip-redesign.md).
