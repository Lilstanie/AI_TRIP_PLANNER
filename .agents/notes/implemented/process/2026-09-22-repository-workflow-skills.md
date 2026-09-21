# Agent Note: Repository workflow skills

Status: implemented
Owner: A (@Lilstanie), repository owner (@HeadmasterEggy)

## Problem

Every AI session relearned the same workflows from scratch, and the session logs show the cost: the
same defects recur across sessions, checks were chosen ad hoc, and 11 of the 36 logs on `main`
record no review other than the author's own ("Reviewer: pending"). DeepSeek Harness keeps each
repeated workflow as a skill in `.agents/skills/`, grounded in evidence from its own history; this
project had only the session-log skill.

## Decision

`.agents/skills/` holds one folder per workflow, read by every AI tool through the `.claude/skills`
symlink. Each skill's `description` states when it applies, its body is guidance rather than a
checklist, and it links to the note or document that owns a fact instead of restating it.

| Skill             | Workflow                                          | Evidence it is drawn from                                                                                                                                                                                     |
| ----------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pre-push-checks` | Pick the narrowest commands that cover the diff   | The four CI commands, focused `--filter` runs in `docs/development.md`, and the `NEXT_DIST_DIR` conflict hit in the env-local and P3.4 sessions                                                               |
| `code-review`     | Check this repository's recurring defect classes  | Rating and per-passenger fare conversions (Places and SerpApi sessions), provenance labels that lied under degradation (PR #31), per-request mode leakage (data-mode session), snapshot versions (AUD change) |
| `ui-verification` | Verify visible changes in a browser at two widths | The 1440 × 1000 and 390 × 844 checks, overflow and Escape-focus findings in the UI P2, P3.4 and calendar sessions                                                                                             |
| `add-provider`    | Add an external data provider safely              | The Google Places and SerpApi integrations: free error-shape probes, typed errors, fallback tiers, stubbed `fetch` tests                                                                                      |
| `agent-notes`     | Write, supersede and archive notes                | The DeepSeek Harness note workflow and this project's note backfill                                                                                                                                           |
| `session-log`     | Write one log per session                         | The team session-log rules                                                                                                                                                                                    |

## Alternatives considered

**Keep workflows in `docs/`.** Rejected: AI tools load skills by their trigger description when the
task matches, while a document has to be found and read first. Facts stay in `docs/`; skills link to
them.

**Copy DeepSeek Harness's skills.** Rejected: their commands, gates and file layout do not exist here.
Only the method is shared — a trigger description, guidance over checklists, links to owning
documents, and evidence from this repository.

**One skill per DeepSeek Harness skill.** Not adopted: translation, performance, stacked-PR and
archive-maintenance workflows address problems this project does not have yet.

## Consequences

- A skill that names a command, path or threshold must change in the same pull request as that fact;
  stale skills mislead every session that loads them. `AGENTS.md` states the rule and
  `pnpm verify:docs` catches broken links and invalid frontmatter, but not stale commands.
- Skills add review surface: a change to one is a team-rule change owned through CODEOWNERS.
- Skills are written or updated by people, or by AI tools when asked or while making a change the
  skill describes. Nothing generates them automatically. DeepSeek Harness maintains only its
  code-review skill periodically, from merged human review feedback, and has not settled that
  workflow; this project has too little human review for that input to exist yet.

## Sources

The session logs named in the table, under `.agents/session-logs/`, and
[the backfilled notes](../feature/2026-09-20-serpapi-live-prices.md) they produced.
