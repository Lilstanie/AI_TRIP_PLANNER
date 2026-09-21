# AGENTS.md — Agent Notes

Agent Notes are decision records written by people and AI tools. Follow the [format and lifecycle
rules](README.md) and use the [agent-notes skill](../skills/agent-notes/SKILL.md) to write, supersede
or archive one.

- Every new note triggers a supersession check against existing notes on the same decision.
- Implemented notes describe shipped reality in the present tense; keep their facts current, never
  rewrite their decision.
- Files under `rejected/` and `archived/` are frozen history, not current authority: never edit them.
