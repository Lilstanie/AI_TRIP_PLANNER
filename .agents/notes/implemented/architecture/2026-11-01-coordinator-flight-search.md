# Agent Note: the coordinator searches flights with a tool

Status: implemented
Owner: C (@HeadmasterEggy)

## Problem

Only a fixed parser could reach the fare search. A flight question it could not read went to the
coordinator, which understood the question but had no search tool, and whose capability text denied
live fares, so it told the traveller that flight search was not built.

## Decision

The coordinator has a `search_flights` tool. The model reads the route and dates in any wording, and
the turn ends in a flight answer with the same frame and cards as the parser's route, so the fares
shown come from the search and not from model text. `parseFlightQuery` stays in front of the model: it
answers without a model call, and it is the only route when models are disabled.

## Alternatives considered

Widening the parser alone: every new wording would need another pattern, and relative dates such as
"mid next month" would never fit one.

## Consequences

A flight question that reaches the coordinator costs a model call before the search. A message that
mixes a flight question with a plan change answers the plan first, and the fares are dropped.
