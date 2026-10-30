# Agent Note: A stay meeting one preference beats one meeting none

Status: implemented
Owner: C (HeadmasterEggy)
Jira: TP-185

## Problem

The stay choice looked only for a candidate rated at least 8 with free cancellation and otherwise
took the cheapest. When no candidate met both, a stay rated 7.2 without free cancellation won over a
stay rated 7.6 with it. Inside a budget share this repeated the case the
[TP-30 decision](2026-10-24-budget-revision-fits-share.md) meant to prevent. In mock data it showed
when a Lisbon trip grew from two to four travellers.

## Decision

`chooseInitial` ranks candidates by how many of the two preferences they meet (rating at least 8,
free cancellation stated as true) and takes the cheapest candidate in the highest rank. A candidate
meeting both still wins; unknown cancellation terms do not count as free cancellation. Mandatory
filters still run first in `eligibleOptions`.

## Alternatives considered

Weighting rating above cancellation, or the reverse, would add a second preference order the
traveller never stated. Keeping the cheapest fallback saves a little but drops a preference the
initial rule already names.

## Consequences

Plans with no fully matching stay can cost slightly more: the Tokyo–Kyoto Agent Lab fixture moves
from AUD 4,333.20 to AUD 4,426.64, because both cities now take the Economy stay with free
cancellation instead of the Saver.
