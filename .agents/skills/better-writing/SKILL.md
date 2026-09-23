---
name: better-writing
description: Use when writing or reviewing interface copy in apps/web of AI_TRIP_PLANNER — button labels, empty states, errors, degraded-source notices, questions the planner asks, aria-labels — so the wording stays plain, consistent and honest about where data came from.
---

# Interface writing

Clear and brief beats clever, and consistent beats varied. The best error message is an interaction
redesigned so that the error cannot happen.

## The voice this product already has

Read the copy around your change before you write. It establishes these conventions:

- **Sentence case** for labels, buttons and headings: "Save trip", "Review plan", "Change trip
  preferences". "Your Trip" is the one established title.
- **Australian and British spelling** in prose: "traveller", "colour". Code identifiers
  keep their existing spelling.
- **Money in the AUD base currency**, written `A$1,234`. Never invent a converted amount the data
  does not hold. See the [AUD base-currency note](../../notes/implemented/architecture/2026-09-20-aud-base-currency.md).
- **Honest provenance.** When a provider falls back to mock, estimated or cached data, the copy says
  so in plain words, and the source badge carries text, not colour alone. Never write copy that
  makes an estimate read like a live price. This defect has shipped before; see the
  [code-review skill](../code-review/SKILL.md).
- **Say "you" to the traveller.** Errors use neutral phrasing like "Unable to load flights" rather
  than "We're having trouble…".

## Rules

- **Buttons start with a verb that names the action**: "Save trip", "Restore trip", "Preview
  changes". Never write "OK", or a bare "Yes"/"No" for a consequential choice. A confirmation button
  restates the consequence: a dialog asking "Delete this chat?" offers "Delete chat" and "Cancel".
- **One word for one thing.** If the sidebar says "Chats", a toast does not say "Conversations". If a
  section is "Timeline & routes", it keeps that name in every place.
- **Tone follows the stakes.** Empty states and onboarding can be warm. Routine actions are neutral.
  Errors and destructive confirmations are calm and plain, with no playfulness and no exclamation
  marks.
- **Errors say how to fix it, next to where it broke**: "Choose a return date after departure", not
  "Invalid dates".
- **Empty states point forward.** Say what the place is for and offer one next action. The blank chat
  starter suggestions are the model.
- **Questions the planner asks** use a short `header`, one plain question, and options that can be
  told apart without reading their descriptions.
- **No sentences built from fragments.** Write a full template with real plurals: "1 stop" / "3
  stops". Concatenated fragments break on translation and plurals.
- **Accessible names match visible text.** An icon-only button's `aria-label` is written in the same
  voice as the visible labels.
- **Placeholders show an example**, like `Kyoto` or `DD/MM/YYYY`. They are never the only label.

## Reporting

Reviewing the source is enough; this skill needs no browser. Order findings by severity:

| Severity | Location | Before | After | Why |
| -------- | -------- | ------ | ----- | --- |

- `HIGH`: misleads the traveller about data or price, or hides how to recover.
- `MEDIUM`: breaks voice, terminology or capitalisation consistency.
- `LOW`: isolated wording polish.
