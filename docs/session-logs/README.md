# Session logs

One note per coding session, named `YYYY-MM-DD-<topic>.md`, based on
[`TEMPLATE.md`](TEMPLATE.md).

One session, one new file. Two people working at the same time create two
different files, so these notes never produce a merge conflict. Keep it that
way: write your own file, do not edit someone else's.

There is deliberately no index table here. The filenames carry the date and
the topic, so `ls docs/session-logs/` is the index — a hand-maintained table
goes stale the first time someone forgets to add a row, and every row added
to it is another line for two people to conflict on.

## How to write one

**Say what changed, then why.** The diff already shows *how*. Git does not
record *why*, which is the one thing a reader cannot recover on their own.

**Be specific in the title.** "Theme the calendar to match the app" is useful;
"UI fixes" is not. This line is what people skim.

**Only claim checks you actually ran.** Paste the real result, including the
number of tests. Never write that something passes because it probably does.

**Link to code, do not paste it.** Reference `apps/web/app/globals.css` or a
symbol name. Pasted code drifts from the file the moment someone edits it.

**Record contract changes in the frontmatter.** `contract-impact` is the field
most likely to save a teammate: anything touching `packages/shared` or the API
routes can break work that is already in progress on another branch.

**Hard limit: 60 lines**, frontmatter included. This is a cap, not a target —
most logs should be well under it. A change that genuinely needs more
explanation belongs in `docs/` as a real document, with the log linking to it.
Check before committing:

```bash
wc -l docs/session-logs/[0-9]*.md | awk '$2 != "total" && $1 > 60 { print $1" lines  "$2 }'
```

## Reading old logs

Logs are historical records, not living documents. Do not rewrite one after
the fact except to correct a factual error. Paths and document names in an old
log describe the repository as it was on that date — for example
`docs/scaffold.md` and `docs/ui-improvements.md` were later merged into
[`team-workflow.md`](../team-workflow.md),
[`architecture.md`](../architecture.md) and
[`workspace-ui.md`](../workspace-ui.md).
