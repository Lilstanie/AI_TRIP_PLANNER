---
name: translate-docs
description: Create and synchronize English and Chinese AI_TRIP_PLANNER documentation pairs under docs/. Use when editing either language, adding or renaming documentation, checking stale translations, or when the user invokes translatedocs or translate-docs. Preserve meaning, examples, links and reviewed unchanged prose.
---

# Translate and synchronize documentation

Maintain `foo.md` and `foo.zh.md` together. Either language can author a change; update the other in
the same task. Follow [documentation ownership](../../../docs/AGENTS.md),
[prose-standard](../prose-standard/SKILL.md) and the [pairing guide](../../../docs/i18n.md).
This skill directs an agent's work; it does not watch files or invoke translation in the background.

## Scope and translation

The pairing scope is ordinary Markdown under `docs/`; `AGENTS.md` and `CLAUDE.md` are instructions,
not duplicated translation sources. Root and package READMEs, skills and Agent Notes are outside
the mandatory pairs. Never edit frozen history or generated code to make a translation pass.

- **Existing pair:** read the diff and surrounding paragraphs in both languages. Translate only the
  changed semantic units. Preserve reviewed text elsewhere; a source edit is not a request to
  rewrite the entire counterpart.
- **New pair:** translate the complete document, not a summary. For substantial independent pages,
  delegate bounded files to a translation subagent and review its result; do not let multiple agents
  write the same file. Translate short pages directly.
- **Rename or deletion:** move or remove both sides only within the user's authorization, repair
  inbound links and explicitly remove obsolete review records. Frozen history remains untouched.
- **Both sides changed:** reconcile the facts with their code or document owner. Never overwrite
  one side blindly or pick English solely because its filename has no locale suffix.

Read a paragraph for meaning, then write natural technical Chinese or English. Compare the finished
translation clause by clause for actors, conditions, ordering, exceptions, units and failure
semantics. Read it alone once for clarity. Use the terminology table in the pairing guide, which gives the Chinese form of the terms in the root `GLOSSARY.md`; keep ambiguous
technical identifiers in English and report unresolved terminology.

Keep heading levels, list types, table structure, inline code and code fences. Code fences, including
comments and Mermaid, stay byte-identical. Chinese links to paired pages use `.zh.md`; retain query
and fragment suffixes. Preserve original English fragment IDs with explicit anchors on Chinese
headings; language-switch links are the intentional cross-language exception. Do not impose equal
physical line counts: prose wrapping differs between languages.

## Review and checks

Run from the repository root after reviewing the meaning and structure of each pair you changed:

```bash
node .agents/skills/translate-docs/scripts/check-pairs.mjs
```

The check compares each pair's structure, inline code, links and heading anchors: each Chinese
heading needs its English counterpart's fragment as an explicit anchor directly above it, unless the
heading text is identical. It also fails when an English page changed since `--base` (by default origin's
main branch) beyond whitespace while its Chinese counterpart did not. Nothing is stored, so there is
no record to refresh or resolve after a merge; editing the Chinese file is not evidence of review, so
review it before pushing. When changing the check script, run
`node apps/web/tests/cli-e2e/translation-pairs.e2e.mjs`.

Follow [pre-push-checks](../pre-push-checks/SKILL.md) for docs, protection and formatting. Run the
pairing check locally for documentation changes (`pnpm verify:pairs` is the same command); CI runs it
after `verify-docs`, so an English change without its Chinese counterpart fails the pull request.
Report translated files, unresolved terms and checks actually run, and add a new
[session log](../session-log/SKILL.md) after edits.
