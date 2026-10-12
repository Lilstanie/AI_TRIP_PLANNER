---
name: better-writing
description: Write interface copy for apps/web of AI_TRIP_PLANNER so wording stays plain, consistent and honest about where data came from. Use when writing or reviewing button labels, empty states, errors, degraded-source notices, questions the planner asks or aria-labels.
---

# Interface writing

Clear and brief beats clever, and consistent beats varied. The best error message is an interaction
redesigned so that the error cannot happen.

## The voice this product already has

Read the copy around your change before you write. It establishes these conventions:

- **Sentence case** for labels, buttons and headings: "Your trip", "Change time", "Move to ideas"
  and "Dismiss". Match the current day view in
  [TripEditor](../../../apps/web/components/trip/TripEditor.tsx) and
  [TimelineStop](../../../apps/web/components/trip/timeline/TimelineStop.tsx).
- **Australian and British spelling** in prose: "traveller", "colour". Code identifiers
  keep their existing spelling.
- **Money uses its established owner.** Planning amounts, guardrails and stored totals stay in AUD;
  `budgetSource` keeps the stated amount and currency. `effectiveCurrency` chooses the trip's named
  currency, then its source budget currency, then Settings. Browser copy uses `money()`, `delta()`
  and `budgetGap()` from `useLocale()`, backed by
  [web money](../../../apps/web/lib/money.ts). Use `fare()` for provider-native evidence, which is
  not converted. Agent Lab's whole-dollar symbol display uses `labMoney` from
  [lab money](../../../apps/web/lib/agent-lab/money.ts); `plannerAud()` in web money spells the AUD
  planning amount. Traveller-facing server summaries, conflicts, progress and replies instead use
  `formatMoney(amountAud, currency)` from [shared money](../../../packages/shared/src/money.ts).
  This display conversion never changes the numeric planning amount. Never hand-build amount strings,
  parse them into calculations, or derive currency from language. Converted copy carries the fixed-rate
  "approximate, not live" estimate notice. The original budget is quoted when its source currency
  matches the display currency. See
  [generated-text formatting](../../notes/implemented/architecture/2026-10-07-one-money-formatter-for-generated-text.md),
  [trip currency](../../notes/implemented/feature/2026-10-07-trip-display-currency.md) and
  [PR #229](https://github.com/Lilstanie/AI_TRIP_PLANNER/pull/229).
- **Every interface string is bilingual.** Write the English text as a key passed to `t()` from
  `useLocale()` and add its Chinese entry to the dictionary in `apps/web/lib/i18n/` (`workspace-messages.ts` for workspace strings); `t()` only
  accepts keys that have a Chinese entry, so a missing one fails the typecheck. When one English word
  needs two translations, add a `|context` suffix (`"Budget|tier"`). Use `{name}` placeholders, not
  concatenation. A notice built outside a component is carried as a keyed `Notice`
  (`{ key, params }`, `apps/web/lib/i18n/notice.ts`; code that throws uses `NoticeError`) and shown
  through `notice()` from `useLocale()`, which translates it once; `{ raw }` preserves external
  text, including provider/model prose and browser errors, rather than new authored copy. The compiler rejects a key without a Chinese entry and a missing or unexpected value.
  A route answers with `noticeBody(notice)`, its `notice` beside the English `error`; the client reads
  a failed response with `failureNotice(body, fallback)` and a caught error with `errorNotice`.
  `notice()` accepts only a `Notice`: there is no lookup from English back to a key, so English
  passed as `{ raw }` stays English. Stored edit notices use `storeNotice` and `readStoredNotice` in
  [notice.ts](../../../apps/web/lib/i18n/notice.ts); older raw messages remain unchanged.
  `conflictsWith` and model/provider prose remain text, not interface keys. The limited
  `keyOfAuthoredSentence` read-back recognizes known authored sentences; it is not a general
  translation path for arbitrary prose. Prefer returning values over sentences when the interface
  builds the line. Traveller text and agent replies are never translated by the interface. See the
  [keyed-notice decision and its stored-edit amendment](../../notes/implemented/architecture/2026-10-06-keyed-notices-everywhere.md).
- **Honest provenance.** When a provider falls back to mock, estimated or cached data, the copy says
  so in plain words, and the source badge carries text, not colour alone. Never write copy that
  makes an estimate read like a live price. This defect has shipped before; see the
  [review-trip-planner skill](../review-trip-planner/SKILL.md).
- **Say "you" to the traveller.** Errors use neutral phrasing like "Unable to load flights" rather
  than "We're having trouble…".

## Rules

- **Buttons start with a verb that names the action**: "Change time", "Replace place", "Undo last
  change", "Retry update". Never write "OK", or a bare "Yes"/"No" for a consequential choice. A confirmation button
  restates the consequence: a dialog asking "Delete this chat?" offers "Delete chat" and "Cancel".
- **Name the current action.** Accepted timeline edits apply immediately after a server check;
  "Checking the change…" describes pending work and "Undo last change" offers recovery. Automatic
  place saving and leg checks are not traveller confirmation steps. Avoid removed "Preview changes",
  "Apply changes", "Review plan" or route-check button examples. Read the rendered controls, since a
  dictionary can retain unused historical keys. See
  [immediate edits and supersessions](../../notes/implemented/feature/2026-10-08-immediate-timeline-edits.md),
  [current check entry point](../../notes/implemented/feature/2026-10-09-check-entry-point.md) and
  [PR #258](https://github.com/Lilstanie/AI_TRIP_PLANNER/pull/258).
- **One word for one thing.** The sidebar says "Chats", the drawer says "Your trip" and the day view
  has "Ideas". Use those names consistently; check nearby rendered copy when a section changes.
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
  voice as the visible labels and goes through `t()` like any visible string.
- **Placeholders show an example**, like `Kyoto` or `DD/MM/YYYY`. They are never the only label.

## Reporting

Reviewing the source is enough; this skill needs no browser. Order findings by severity:

| Severity | Location | Before | After | Why |
| -------- | -------- | ------ | ----- | --- |

- `HIGH`: misleads the traveller about data or price, or hides how to recover.
- `MEDIUM`: breaks voice, terminology or capitalisation consistency, or a string bypasses `t()`.
- `LOW`: isolated wording polish.
