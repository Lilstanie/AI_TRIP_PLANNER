# .agents

Shared, versioned material for AI coding tools. Every tool reads the same files: `CLAUDE.md` links to
`AGENTS.md`, and `.claude/skills` links to [`skills/`](skills/).

| Path                                      | Tracked | Contents                                                                                              |
| ----------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------- |
| [`notes/`](notes/README.md)               | yes     | Agent Notes: decisions with their rationale, by lifecycle and class                                   |
| [`session-logs/`](session-logs/README.md) | yes     | One log per AI-assisted session; history, never a source of decisions                                 |
| [`skills/`](skills/)                      | yes     | Repeatable workflows for this repository, one folder per skill with a `SKILL.md`                      |
| [`archive/`](archive/)                    | yes     | Dated plans, audits and module handoffs moved out of `docs/`; frozen history, never current authority |
| `local/`                                  | no      | Personal session context such as `PROJECT.md` and `CURRENT_STATE.md`; never authoritative             |

Move an old `.ai/` directory with `mv .ai .agents/local`.
