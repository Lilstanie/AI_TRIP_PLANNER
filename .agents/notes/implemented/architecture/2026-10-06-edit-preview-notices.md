# Agent Note: Edit preview answers with Notices beside its English text

Status: implemented

## Problem

A traveller using the Chinese interface read some edit preview errors in English. The edit preview
route returned blockers and refusals as English sentences, and the interface translated only those
it recognised, by exact dictionary match or by a regular expression per sentence with a value in it.
A refusal such as "This edit is stale" had no entry at all, and each new sentence with a value needed
a new pattern kept in step with the code that built it.

## Decision

Trip-edit validation (`apps/web/lib/trip/trip-edit.ts`) and the itinerary item actions
(`apps/web/lib/trip/item-actions.ts`) throw `NoticeError` with a keyed `Notice`
(`apps/web/lib/i18n/notice.ts`). `previewEdit` builds its blockers as Notices: the app's own wording
is `{ key, params }`; a route provider's text is `{ raw }`; a failure with no wording is
`{ key: "Route verification failed" }` or `{ key: "Route unavailable" }`.

`POST /api/trip/preview-edit` adds fields and removes none:

- a preview carries `blockerNotices: Notice[]` beside `blockers: string[]`, the same blockers in
  English;
- a refusal answers 400 with `{ error, notice }`, where `error` is the English sentence and `notice`
  the same refusal; an error that is not a `NoticeError`, such as a malformed body, is
  `{ raw: message }`.

The timeline shows `blockerNotices` and the refusal's `notice` through `useLocale().notice()`. A
blocker the edit leaves unresolved is still saved on the plan (`conflictsWith`, `editIssues`) as an
English sentence, since `TripPlan` in `packages/shared` stores strings. The four trip-edit patterns
left `NOTICE_PATTERNS`, which was later deleted with the rest of the English lookup (see the
[keyed notices note](2026-10-06-keyed-notices-everywhere.md)).

## Alternatives considered

- **Replace `blockers` and `error` with Notices.** Simpler, but a client built before this change
  would show `[object Object]` or nothing. The spec asked for `notice` beside `error` so older
  clients keep working.
- **Keep English and add more patterns.** Rejected by the spec this ticket implements (#196): the
  patterns had to be kept in step with the sentences by hand, and a mismatch failed silently into
  English.

## Consequences

- Each new authored blocker or refusal is a dictionary key; the typecheck rejects one without a
  Chinese entry or with missing values.
- The response carries every blocker twice until the English fields can be dropped.
- Blockers saved on the plan still reach the traveller in English. Route lookup failures became
  keyed when the Google integration began throwing `NoticeError` (#205).

## Sources

- Issue #204, spec #196; builds on #200 (Notice type).
- Related: [interface language note](../feature/2026-10-04-interface-language-only.md).
- Session log `.agents/session-logs/2026-10-06-keyed-notices-preview.md`.
