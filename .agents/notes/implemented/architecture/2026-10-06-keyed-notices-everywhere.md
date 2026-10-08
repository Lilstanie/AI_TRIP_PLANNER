# Agent Note: Every workspace notice is a key; the English lookup is gone

Status: implemented

## Problem

After the attachment and edit preview notices became keyed `Notice`s, the rest of the workspace still
produced English sentences: field errors, request failures, storage, map and location messages, the
account delete error, place search errors and every route's `error`. `useLocale().notice()` accepted a
string and translated it only when it matched a dictionary key exactly or a regular expression in
`NOTICE_PATTERNS`. A sentence with no match, such as "Google Places is busy" or "Note saved.", showed
in English in the Chinese interface, and nothing warned when a producer drifted from its pattern.

## Decision

`notice()` accepts only `Notice | undefined`. `interfaceNotice`, `NOTICE_PATTERNS` and the
exact-match fallback are deleted from `apps/web/lib/i18n/locale.ts`, so the compiler finds any
producer that still passes a string.

`apps/web/lib/i18n/notice.ts` adds three helpers:

- `noticeBody(notice)` is a route's JSON failure body, `{ error, notice }`, with `error` in English
  for logs and older clients. The places, account, chat, routes and preview-edit routes and the
  account helpers (`apps/web/lib/account/server.ts`) answer with it. A chat `error` stream frame
  carries the same two fields.
- `failureNotice(body, fallback)` reads a failed response on the client: a well-formed `notice` wins,
  an `error` without one is `{ raw }` (nothing says it was authored), and a missing or malformed body
  shows `fallback`, usually `Request failed ({status}).`
- `errorNotice(error, fallback)` reads something caught: a `NoticeError` keeps its notice, any other
  `Error` is `{ raw: message }`, and a thrown non-error shows `fallback`.

The Google integration (`apps/web/lib/integrations/google.ts`) throws `NoticeError` for its own
sentences, `GoogleRequestError` extends `NoticeError`, and an unavailable `RouteResult` carries
`notice` beside its English `error`. Session state (`lib/workspace/session.ts`) holds `error` and the
per-field `errors` as Notices, and `briefErrors` maps each brief field to a key, so a schema message
never reaches the traveller.

## Alternatives considered

- **Keep the English lookup as a safety net.** Rejected by the spec (#196): it hid unconverted
  producers, so a new English sentence shipped silently instead of failing the typecheck.
- **Replace `error` with `notice` in route bodies.** Simpler, but a client built before this change
  reads `error`; the preview-edit route already set the pattern of adding `notice` beside it.

## Consequences

- A new authored notice must be a dictionary key with a Chinese entry; a string no longer compiles.
- Text from outside the app (an error body with no `notice`, a browser's `Failed to fetch`, a zod
  issue from the account sync schema) is shown unchanged in both languages.
- Agent progress errors, Agent Lab text and blockers saved on a plan (`conflictsWith`, `editIssues`)
  remain English strings; they are agent or stored content, not interface notices.
- Dated 2026-10-08: `editIssues[].message` now stores a keyed notice, encoded as `"notice:" + encodeURIComponent(JSON)`
  and read back by `readStoredNotice` (`apps/web/lib/i18n/notice.ts`), so a stored leg or timing notice shows in the
  traveller's language. `conflictsWith` stays English because the orchestrator chat reads it. The `editIssues` part of
  the bullet above is superseded; the rest stands.

## Sources

- Issue #205, spec #196; builds on #200 (Notice type) and #204
  ([edit preview notices](2026-10-06-edit-preview-notices.md)).
- Related: [interface language note](../feature/2026-10-04-interface-language-only.md).
- Session log `.agents/session-logs/2026-10-06-keyed-notices-contract.md`.
