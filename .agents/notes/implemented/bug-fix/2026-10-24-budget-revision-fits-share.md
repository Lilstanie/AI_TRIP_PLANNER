# Agent Note: A budget revision keeps the best stay that fits the share

Status: implemented
Owner: C (HeadmasterEggy)
Jira: TP-30

## Problem

A budget revision took the cheapest eligible stay whenever a stay allocation existed. A saver stay at
AUD 880 won over an economy stay at AUD 960 even when the economy stay fit the revised share, so the
traveller lost a better-ranked stay for a saving the plan did not need.

## Decision

When the stay has a budget allocation, a budget revision picks the highest-ranked eligible candidate
whose total fits that stay's share of the revised budget. The ranking is the initial selection rule:
rating at least 8 with free cancellation first. If no candidate fits, the cheapest eligible candidate
is taken and the orchestrator decides the next budget step. Without an allocation, a budget revision
still takes the cheapest eligible stay, because no share is known to fit against.

This supersedes the cheapest-only rule in the accommodation behaviour described in
[the member C behaviour page](../../../../docs/design/stage1/04-member-c-behaviour.md).

## Alternatives considered

Keeping the cheapest pick maximises saving but ignores the traveller's rating and cancellation
preferences that the initial selection already honours. Ranking on price alone inside the share
would re-run the same trade-off the initial rule settles.

## Consequences

Budget revisions with an allocation can save less than before, so the orchestrator may need one more
round to reach the target. The summary and assumptions say "highest-ranked stays that fit the revised
share" and drop "(lowest eligible cost)" in that case.
