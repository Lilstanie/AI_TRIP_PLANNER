# Agent Note: Align Trip interactions with observed Mindtrip workflows

Status: proposed

## Problem

PR #782 keeps Chats and five actions inside a Trip, but matching the page regions does not
complete the interaction. The owner requests direct Mindtrip research, a documented comparison,
then grilling, a spec and tickets before further implementation. Continue PR #782 and do not merge.

The [bilingual reference](../../../../docs/design/mindtrip-interactions.md) records observed
behaviour separately from unperformed edits. Existing decisions remain authoritative:
[Trip home actions](../../../notes/implemented/feature/2026-10-29-trip-home-actions.md)
keeps Chats in place, while [Trip home Chats](../../../notes/implemented/feature/2026-10-28-trip-home-chats.md)
defines multiple Chats within one Trip. No supersession is accepted here.

## Proposal

Use the following comparison to review the proposed scope; tickets remain local drafts until approved.

| Area            | Existing behaviour                                                         | Observed reference or gap                                             | Evidence                                                                                    |
| --------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| New Chat entry  | An unlabelled-looking empty textarea and Start chat button follow the list | A visible Trip-specific prompt and a desktop bottom composer          | Browser baseline: no placeholder; composer y=423 at 1440 × 1000; Enter does not open a Chat |
| Chat list       | Each linked Chat has title and date                                        | Visible count and forward arrow make the multiple-Chat model clearer  | Source and reference browser                                                                |
| Fact editing    | Destination, dates, travellers and budget are plain tags                   | Reference exposes fact buttons                                        | Source and reference browser; reference editing outcomes not tested                         |
| Calendar        | A read-only month grid opens an Itinerary day                              | Reference uses day columns, time axis and an all-day stay lane        | Source and reference browser                                                                |
| Itinerary       | Trip home shows read-only stop text                                        | Reference exposes stop details, time editing and daily map controls   | Source and rendered reference controls; reference edits not executed                        |
| Panel space     | Fixed right drawer width, close/Escape/outside return focus                | Reference expands to content plus map and collapses back              | Source and reference browser; Ideas expansion and collapse control observed                 |
| Mobile          | Existing single page scroll, actions, Chats, map and composer              | Reference exposes Up Next and Chats entry points with bottom composer | Browser viewport simulation; no physical-device evidence                                    |
| Input ownership | Composer uses local state without a Trip key                               | A pending draft must not silently move to another Trip                | Source risk; actual direct-switch reproduction still needed                                 |

Prioritise working paths over decorative parity. Keep existing account boundaries, data provenance,
semantic tokens, accessibility and the latest-Plan contract. Media, collaboration, voice and receipts
need product decisions and real data flows rather than empty matching controls.

### Confirmed scope

The owner accepts the following interview decisions on 29 October 2026:

- Calendar provides a week time-axis view and a month view; clicking an activity opens details
  or editing. Drag-to-reschedule is deferred.
- Itinerary reuses the existing editing behaviour directly in the right-side panel, including
  time, place, moving to Ideas and Undo.
- Phone retains the current navigation. Prioritise the bottom composer, multiple Chat entries
  and full-screen right-side actions; do not copy the Up Next partition in this scope.

- Nonempty Trip home input creates a linked Chat and sends its first message directly; Enter
  sends, Shift+Enter inserts a newline and IME confirmation does not send.
- Destination, dates, travellers and budget each have independent editing entries; preferences
  remain separate and reuse existing save/replan rules.
- Desktop panels expand into content and map side by side and collapse back; phone remains full screen.

The owner requests a local spec and ticket draft before publication or implementation. The owner approved splitting the draft into nine slices; publication and implementation remain pending approval.
The [review draft](2026-10-29-mindtrip-interaction-spec.md) records the scope, test seam and blocking edges.
No GitHub/Jira publication is authorised until that draft is approved.

### Additional owner corrections and current-code evidence

- The sidebar primary action becomes New chat and calls the generic Chat flow. Ordinary chatting
  must not create a Trip or require a travel brief. A separate Trips entry can still create a Trip.
- Trip home removes the separate Start chat button. Focusing or typing creates nothing; first
  nonempty Send creates the linked Chat. This supersedes the earlier draft's empty-input start rule.
- The Trip home Itinerary and the conversation's top-right Trip reuse the same editor, latest Plan,
  activity identities, pending-edit state and Undo; both immediately reflect edits from either entry.
- Generation belongs to its originating Chat and continues during in-app page/Chat navigation.
  Returning restores progress or completed output. Explicit Stop remains cancellation; closing or
  refreshing the browser is not promised to run a durable background task in this scope.
- Source inspection: `useWorkspace` aborts its active request inside `open`, reached by loading a
  Chat or Trip. `useWorkspaceTransport` ignores an outcome once its controller is no longer active.
  Navigation that only changes layout does not necessarily call `open`; the reported generic
  page-switch symptom still requires controlled browser reproduction per route.
- A local browser review observed a map cleanup crash at `TripMap.tsx:265`, a Google error layer
  alongside fallback map elements, and two indistinguishable Chat titles/dates. Map lifecycle and
  generation continuity are separate tickets rather than hidden inside visual polish.
- The existing catalog/storage decision says switching Trips aborts the in-flight turn. The proposed
  continuity contract changes that policy; link a superseding Agent Note when implementing rather
  than silently changing the implemented record. Deleting a Chat and explicit Stop still cancel.

## Alternatives considered

- Continue visual tweaks immediately: rejected for this phase because the owner explicitly requests
  the interaction model and approved scope first.
- Copy every Mindtrip control: not accepted; several workflows have no equivalent product model.
- Change the shared Trip/Chat model now: not justified by the observed navigation differences.

## Acceptance criteria

- The owner can read the interaction reference in Chinese and English, including verification limits.
- Grilling settles Calendar scope, in-place editing, fact editors, mobile priorities and exclusions.
- The spec preserves multiple Chats per Trip and the agreed latest-Plan and return-path behaviour.
- Approved vertical tickets have blocking edges and the requested Jira mapping.
- Implementation updates PR #782 with repeatable browser evidence before any readiness claim.
- No PR merges without the owner's explicit instruction.

## Risks

- Earlier screenshot approval does not settle time-axis editing, drag scheduling or collaboration.
- A short-lived entry prototype was saved outside the repository and removed from the working tree;
  its green checks do not prove the current tree implements those changes.
- The existing action-rail script produced additional baseline failures, including an 8px drawer gap
  against a 2px tolerance and missing-content assertions. Preserve the failed report and diagnose
  rendering synchronisation versus product failures before treating this script as acceptance evidence.

## Sources

- [Mindtrip](https://mindtrip.ai), observed 29 October 2026 with an existing signed-in account.
- [PR #782](https://github.com/Lilstanie/AI_TRIP_PLANNER/pull/782).
- Local retained evidence: `/Users/joey/.codex/visualizations/2026/10/29/mindtrip-interaction-research/`.
