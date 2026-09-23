---
name: break
description: Use when asked to stress-test one apps/web component of AI_TRIP_PLANNER — render it on a throwaway dev-only debug page under every scenario its props can reach (long mixed-script names, huge AUD amounts, zero or many stops, degraded sources, narrow containers) and report what visibly broke.
disable-model-invocation: true
---

# Break

This skill takes one component and renders it on a throwaway page under every scenario that can
reach it in production. That page is the deliverable: a visual report the user scrolls through, with
every state side by side and the breaks marked. A component built for one happy path looks finished
until real provider data arrives.

The skill observes; it does not judge. A finding is something that visibly broke on the page. Code
review against a standard belongs to the review skills.

## 1. Scope one component

Test one component per run. "The trip drawer" is not a component; `TripSection` or `SourceBadge` is.
If the request covers several, list the candidates and ask which one to test. State in one sentence
what the component accepts, what it renders and where it lives.

## 2. Pick the scenarios from its props

Read the component's props, states and the data it renders. Go through
[scenarios.md](scenarios.md) and keep only the axes whose cue matches. Write the kept scenarios down,
one line each, before you build. Say in one line which axes you dropped and why.

## 3. Build the harness page

- Create `apps/web/app/debug/break-<component>/page.tsx` as a client component (`"use client"`).
  Copy the production guard from the existing debug pages:
  `if (process.env.NODE_ENV === "production") notFound();`.
- Import the **real** component from `@/components/...`. Feed each scenario as props or fixture
  data, using the types from `@trip/shared` and `@/lib/workspace`. Do not use live providers,
  production state or stores.
- Render the scenarios in a single column, with a short text label above each. Widths are scenarios
  too: render the fixed-width containers side by side, so one load shows every width.
- The page adds only labels, container widths and fixtures. It adds no fonts, styles or theme
  overrides of its own, so the component renders with the app's real tokens.
- The harness is scratch work. Never commit it or import it from production code.

## 4. Look once

Start the `web` preview from `.claude/launch.json` with mock data, open
`/debug/break-<component>`, and read every scenario from top to bottom in one pass. Report what you
see, such as "the hotel name escapes the card's right edge", never taste. If the page cannot render
without debugging, hand the URL to the user instead.

Mark each break with a one-line note under its scenario's label, so the page reads as the report on
its own.

## 5. Report and stop

| Scenario                  | Observed                                     | Owner           |
| ------------------------- | -------------------------------------------- | --------------- |
| 80-character hotel name   | Overflows the card, no wrap or clamp         | `better-layout` |
| Fallback source, no price | Badge wraps and pushes the price off the row | `better-layout` |

The owner is the skill whose rules explain the fix: `better-layout`, `better-accessibility`,
`better-ui` or `better-writing`. Colour and type breaks go to the
[design contract](../../../docs/design/ui-guidelines.md). "Everything survived" plus the list of
scenarios is a complete report. Do not fix anything unless asked. After a fix, re-render the failing
scenarios.

## 6. Clean up on request

Leave the page running, because it is half of the report. Delete it and its fixtures when the user
says they are done, and in any case before the branch is pushed. Check the result with
`git status --short apps/web/app/debug`.
