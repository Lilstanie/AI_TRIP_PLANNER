# Agent Note: next-intl message catalogs with native Chinese copy

Status: implemented
Owner: C (@HeadmasterEggy)

## Problem

Interface copy was a hand-built `t()` keyed by the English sentence, with one Chinese dictionary per
area (`workspace-messages.ts`, `phone-messages.ts`). Every Chinese entry was written as a translation
of its English key, so the Chinese interface read as word-for-word English. Plurals were separate
singular and plural keys, and a sentence with a value was often concatenated from fragments, which
fixed English word order in both languages.

## Decision

The web app uses next-intl without locale routing. `LocaleProvider` wraps the workspace in
`NextIntlClientProvider` and `useLocale().t` calls `useTranslations()`; code outside React uses
`translate(locale, id)`, built on next-intl's `createTranslator`. Copy lives in
`apps/web/lib/i18n/messages/`: `en-workspace.ts` and `en-shell.ts` are `as const`, and the zh catalogs
`satisfies` the same keys, so a missing Chinese entry fails the typecheck. Keys are camelCase message
ids, not English sentences. Counts use ICU plurals, and a line with values is one message with
placeholders, so Chinese can order it naturally. The Chinese values were rewritten as native copy while
keeping the established terms (轨迹, 智能体团队, 备选地点, 待处理, 显示币种).

English values that are also stored or compared as data (saved interests, dietary needs, open-item
kinds, "New chat", the welcome message) stay English in data and are looked up with `keyForText` or
`keyForStoredText`. Keyed notices stored before this change carry the English sentence as their key;
`readStoredNotice` and `failureNotice` map it to the message id, so old plans still render in the
chosen language. A placeholder a caller leaves out stays visible as `{name}`.

This replaces the dictionary mechanism in
[interface language](../feature/2026-10-04-interface-language-only.md); its language setting, browser
default and scope decisions are unchanged. [Keyed notices](2026-10-06-keyed-notices-everywhere.md)
keep their shape.

## Alternatives considered

- Keep the custom `t()` and only rewrite the Chinese values: English-sentence keys and fragment
  concatenation would still force English word order and singular/plural key pairs.
- next-intl with locale routing (`/en`, `/zh`): the language is a saved setting, not a URL, and
  routing would change every page path for no traveller benefit.

## Consequences

Adding copy means adding an id to an en catalog and a native value to its zh pair. Server-side
Chinese text in `packages/orchestrator` (chat summaries, progress copy, brief intake) and the
trajectory locale dictionary are outside these catalogs and still need the same rewrite.

## Sources

- Joey's request in the project thread, 2026-10-31: replace the literal translation with a ready-made
  library and native Chinese.
- [next-intl without i18n routing](https://next-intl.dev/docs/getting-started/app-router/without-i18n-routing)
