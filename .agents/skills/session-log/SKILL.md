---
name: session-log
description: Use at the end of any AI-assisted coding session in AI_TRIP_PLANNER, or when asked to write or check a session log, to add one new file under .agents/session-logs/ that follows the team template and limits.
---

# Write a session log

1. Create exactly one new file `.agents/session-logs/YYYY-MM-DD-<topic>.md` from
   [`TEMPLATE.md`](../../session-logs/TEMPLATE.md). Never edit an existing dated log, including
   your own from an earlier session; `pnpm verify:protected` rejects it.
2. Fill the frontmatter. Set `contract-impact` to `packages/shared` or `api` whenever those changed.
3. Write what changed, then why. List only commands you actually ran, with their real results.
4. Stay under 60 lines. Move anything longer into `docs/`, or into an Agent Note under
   `.agents/notes/` when it records a decision, and link to it.
5. Check the length:

   ```bash
   wc -l .agents/session-logs/[0-9]*.md | awk '$2 != "total" && $1 > 60 { print $1" lines  "$2 }'
   ```
